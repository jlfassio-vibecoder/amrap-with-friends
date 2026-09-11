-- The workout collection: what this room actually runs.
--
-- The plan calls it "the coach's published workouts, each launchable as a
-- personal mission". There is no publishing mechanism yet and deliberately so
-- -- `workout_publications`, the weekly window and standings are Phase 3, and
-- they are the release valve for a room too large to share one clock. This is
-- the 2a half: the workouts the room has already run, offered back.
--
-- Derived rather than curated, which is the honest version. A room cannot
-- advertise a workout it has never run, and a collection built from history
-- cannot go stale against a schedule nobody updated.
--
-- The workout jsonb is returned, not just the template id, because the entry
-- has to describe itself: its duration, the unit it is counted in, and whether
-- it is scorable at all come from the run, not from the library.
--
-- It is not what a launch runs. The client starts a mission through
-- /create?template=, against the library's current version. CLAUDE.md's
-- snapshot rule protects a *recorded result* from a later edit; starting a new
-- mission is a different act, and every other surface that offers a template
-- launches the current one.
--
-- Deduped on the template when there is one and on the workout's content when
-- there is not, so a room running the same session every Tuesday lists it once.
-- Most recently run first: that is the room's current programming.

CREATE OR REPLACE FUNCTION public.list_room_workouts(p_room_id uuid, p_limit int DEFAULT 12)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  IF p_room_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT coalesce(jsonb_agg(row ORDER BY last_run DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    -- Three levels, and each one earns its keep: DISTINCT ON must order by its
    -- own key, so the "most recent first" ordering and the limit cannot live in
    -- the same query as the dedupe. Putting the limit outside the aggregate
    -- instead would have limited the single aggregate row -- inert, and
    -- silently so.
    SELECT last_run, row
    FROM (
      SELECT DISTINCT ON (coalesce(m.template_id, md5(m.workout::text)))
        m.created_at AS last_run,
        jsonb_build_object(
          'workout_key', coalesce(m.template_id, md5(m.workout::text)),
          'template_id', m.template_id,
          'workout', m.workout,
          'duration_minutes', m.duration_minutes,
          'intensity_tier', m.intensity_tier,
          'score_unit', public.mission_score_unit(m.workout),
          'last_run', m.created_at,
          -- How many people have finished it here. A workout the room ran once
          -- for nobody is not programming, and the page can say so.
          'finishers', (
            SELECT count(*)
            FROM public.missions m2
            JOIN public.participants p2 ON p2.mission_id = m2.id
            JOIN public.participant_segment_results psr2
              ON psr2.participant_id = p2.id AND psr2.segment_index = m2.segment_index
            WHERE m2.room_id = p_room_id
              AND coalesce(m2.template_id, md5(m2.workout::text))
                = coalesce(m.template_id, md5(m.workout::text))
              AND psr2.final_score IS NOT NULL
              AND p2.role <> 'host'
          )
        ) AS row
      FROM public.missions m
      WHERE m.room_id = p_room_id
        AND m.state = 'finished'
        AND jsonb_typeof(m.workout) = 'array'
        AND jsonb_array_length(m.workout) > 0
      -- DISTINCT ON keeps the first row per key, so this ordering decides
      -- *which* run represents the workout: the latest, whose jsonb is the
      -- version the room is running now.
      ORDER BY coalesce(m.template_id, md5(m.workout::text)), m.created_at DESC
    ) deduped
    ORDER BY last_run DESC
    LIMIT least(greatest(coalesce(p_limit, 12), 1), 50)
  ) rows;

  RETURN jsonb_build_object('ok', true, 'workouts', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.list_room_workouts(uuid, int) FROM PUBLIC;
-- Public, like the room page it sits on. Launching one is create_mission,
-- which anon may already call -- a guest can train a coach's workout without
-- an account, which is the whole return loop.
GRANT EXECUTE ON FUNCTION public.list_room_workouts(uuid, int) TO anon, authenticated;
