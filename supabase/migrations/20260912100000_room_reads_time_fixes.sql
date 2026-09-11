-- Two reads were measuring the wrong time.
--
-- Both follow from scheduling, added in #179: a room mission can now be created
-- up to sixty days before it runs, so `created_at` stopped being a proxy for
-- when anything happened.

/** How long a mission that was never started keeps appearing as upcoming. */
CREATE OR REPLACE FUNCTION public.room_upcoming_grace_hours()
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, extensions
AS $$ SELECT 3 $$;

-- 1. "This week" now means missions that ran this week, not missions created
--    this week. A coach who schedules three weeks ahead and runs it today was
--    told nobody finished, because the row was created twenty-one days ago.
CREATE OR REPLACE FUNCTION public.room_activity_summary(p_room_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_since timestamptz := now() - interval '7 days';
  v_finished_week int;
  v_athletes_week int;
  v_returning int;
  v_missions_week int;
BEGIN
  IF v_uid IS NULL OR coalesce(public.room_role(p_room_id, v_uid), '') NOT IN ('owner', 'cohost') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  -- Windowed on when the score was recorded, which is when the athlete
  -- actually finished.
  SELECT count(*), count(DISTINCT p.user_id)
  INTO v_finished_week, v_athletes_week
  FROM public.missions m
  JOIN public.participants p ON p.mission_id = m.id
  JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
   AND psr.segment_index = m.segment_index
  WHERE m.room_id = p_room_id
    AND psr.final_score IS NOT NULL
    AND psr.updated_at >= v_since;

  -- A mission belongs to the week it was meant to run in, not the week it was
  -- typed in. Undated missions open immediately, so their creation is their
  -- start.
  SELECT count(*) INTO v_missions_week
  FROM public.missions m
  WHERE m.room_id = p_room_id
    AND coalesce(m.scheduled_at, m.created_at) >= v_since
    AND coalesce(m.scheduled_at, m.created_at) <= now();

  SELECT count(*) INTO v_returning
  FROM (
    SELECT p.user_id
    FROM public.missions m
    JOIN public.participants p ON p.mission_id = m.id
    JOIN public.participant_segment_results psr
      ON psr.participant_id = p.id
     AND psr.segment_index = m.segment_index
    WHERE m.room_id = p_room_id
      AND psr.final_score IS NOT NULL
      AND p.user_id IS NOT NULL
      AND p.role <> 'host'
    GROUP BY p.user_id
    HAVING count(DISTINCT m.id) > 1
  ) repeat_athletes;

  RETURN jsonb_build_object(
    'ok', true,
    'finished_this_week', coalesce(v_finished_week, 0),
    'athletes_this_week', coalesce(v_athletes_week, 0),
    'missions_this_week', coalesce(v_missions_week, 0),
    'returning_athletes', coalesce(v_returning, 0)
  );
END;
$$;

-- 2. A mission that was scheduled and never started stayed 'waiting' for ever,
--    and `upcoming` is ordered soonest-first, so last Tuesday's abandoned
--    mission outranked every real one and the room page advertised a date in
--    the past as its next mission. Nothing expires room missions, so the read
--    has to.
--
--    Live missions are never dropped: a mission in setup or work is happening
--    regardless of what its clock says.
CREATE OR REPLACE FUNCTION public.list_room_missions(p_room_id uuid, p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_grace interval := (public.room_upcoming_grace_hours() || ' hours')::interval;
  v_upcoming jsonb;
  v_recent jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(row ORDER BY ord ASC), '[]'::jsonb)
  INTO v_upcoming
  FROM (
    SELECT
      coalesce(m.scheduled_at, '-infinity'::timestamptz) AS ord,
      jsonb_build_object(
        'mission_id', m.id,
        'state', m.state,
        'duration_minutes', m.duration_minutes,
        'template_id', m.template_id,
        'scheduled_at', m.scheduled_at,
        'created_at', m.created_at,
        'finishers', 0
      ) AS row
    FROM public.missions m
    WHERE m.room_id = p_room_id
      AND m.state IN ('waiting', 'setup', 'work')
      AND (
        m.state IN ('setup', 'work')
        OR coalesce(m.scheduled_at, m.created_at) > now() - v_grace
      )
    ORDER BY coalesce(m.scheduled_at, '-infinity'::timestamptz) ASC
    LIMIT v_limit
  ) upcoming;

  SELECT coalesce(jsonb_agg(row ORDER BY ord DESC), '[]'::jsonb)
  INTO v_recent
  FROM (
    SELECT
      coalesce(scored.completed_at, m.created_at) AS ord,
      jsonb_build_object(
        'mission_id', m.id,
        'state', m.state,
        'duration_minutes', m.duration_minutes,
        'template_id', m.template_id,
        'scheduled_at', m.scheduled_at,
        'created_at', m.created_at,
        'completed_at', scored.completed_at,
        'finishers', scored.finishers
      ) AS row
    FROM public.missions m
    JOIN LATERAL (
      SELECT count(*)::int AS finishers, max(psr.updated_at) AS completed_at
      FROM public.participants p
      JOIN public.participant_segment_results psr
        ON psr.participant_id = p.id AND psr.segment_index = m.segment_index
      WHERE p.mission_id = m.id AND psr.final_score IS NOT NULL
    ) scored ON true
    WHERE m.room_id = p_room_id
      AND m.state = 'finished'
      AND scored.finishers > 0
    ORDER BY coalesce(scored.completed_at, m.created_at) DESC
    LIMIT v_limit
  ) recent;

  RETURN jsonb_build_object('ok', true, 'upcoming', v_upcoming, 'recent', v_recent);
END;
$$;

REVOKE ALL ON FUNCTION public.room_upcoming_grace_hours() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_room_missions(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_room_missions(uuid, int) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.room_activity_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.room_activity_summary(uuid) TO authenticated;
