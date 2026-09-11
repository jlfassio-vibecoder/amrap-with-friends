-- The collection was ordering by the wrong time, again.
--
-- `list_room_workouts` took `last_run` from `m.created_at`, which since #179 is
-- when the mission row was *made* -- up to sixty days before it runs. Two
-- consequences, and the second is the worse one:
--
--   1. A workout created earlier but run later sorts below one created later
--      and run sooner, so "what this room is running now" is not what the list
--      leads with.
--   2. DISTINCT ON picks the *representative* run by that same ordering, so the
--      duration, tier and scorability shown for a workout can come from a run
--      that is not the room's latest.
--
-- 20260912100000_room_reads_time_fixes.sql fixed exactly this for two other
-- room reads, and its own header says created_at stopped being a proxy for when
-- anything happened. I wrote this one file later and reached for it anyway.
--
-- Same shape as that fix: max(psr.updated_at) is when a mission was actually
-- finished, with created_at as the fallback for a finished mission nobody
-- scored.

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
        coalesce(scored.completed_at, m.created_at) AS last_run,
        jsonb_build_object(
          'workout_key', coalesce(m.template_id, md5(m.workout::text)),
          'template_id', m.template_id,
          'workout', m.workout,
          'duration_minutes', m.duration_minutes,
          'intensity_tier', m.intensity_tier,
          'score_unit', public.mission_score_unit(m.workout),
          'last_run', coalesce(scored.completed_at, m.created_at),
          -- How many people have finished it here, across every run of it. A
          -- workout the room ran once for nobody is not programming, and the
          -- page can say so.
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
      LEFT JOIN LATERAL (
        SELECT max(psr.updated_at) AS completed_at
        FROM public.participants p
        JOIN public.participant_segment_results psr
          ON psr.participant_id = p.id AND psr.segment_index = m.segment_index
        WHERE p.mission_id = m.id
          AND psr.final_score IS NOT NULL
          AND p.role <> 'host'
      ) scored ON true
      WHERE m.room_id = p_room_id
        AND m.state = 'finished'
        AND jsonb_typeof(m.workout) = 'array'
        AND jsonb_array_length(m.workout) > 0
      -- DISTINCT ON keeps the first row per key, so this ordering decides
      -- *which* run represents the workout: the one most recently finished.
      ORDER BY
        coalesce(m.template_id, md5(m.workout::text)),
        coalesce(scored.completed_at, m.created_at) DESC
    ) deduped
    ORDER BY last_run DESC
    LIMIT least(greatest(coalesce(p_limit, 12), 1), 50)
  ) rows;

  RETURN jsonb_build_object('ok', true, 'workouts', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.list_room_workouts(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_room_workouts(uuid, int) TO anon, authenticated;
