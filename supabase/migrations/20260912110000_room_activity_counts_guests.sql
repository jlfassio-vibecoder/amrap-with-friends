-- Count guests as athletes.
--
-- `count(DISTINCT p.user_id)` ignores nulls, and a guest participant has no
-- user_id -- so a room whose finishers were all guests reported "1 finish this
-- week from 0 athletes", which is both wrong and obviously wrong on the page.
--
-- Guests are not an edge case here: finishing without an account is the whole
-- premise of the room loop, and the post-finish sheet exists to convert exactly
-- those people. A participant row is one athlete whether or not it has an
-- account behind it, so identity falls back to the participant id.
--
-- `returning_athletes` deliberately does NOT do this: two guest finishes cannot
-- be shown to be the same person, and inventing a returner would corrupt the
-- pilot's primary metric.

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

  SELECT
    count(*),
    -- One athlete per participant row; the account is how we recognise someone
    -- across missions, not what makes them a person.
    count(DISTINCT coalesce(p.user_id::text, p.id::text))
  INTO v_finished_week, v_athletes_week
  FROM public.missions m
  JOIN public.participants p ON p.mission_id = m.id
  JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
   AND psr.segment_index = m.segment_index
  WHERE m.room_id = p_room_id
    AND psr.final_score IS NOT NULL
    AND psr.updated_at >= v_since;

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

REVOKE ALL ON FUNCTION public.room_activity_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.room_activity_summary(uuid) TO authenticated;
