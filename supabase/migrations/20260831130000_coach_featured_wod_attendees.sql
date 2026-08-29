-- Featured WOD phase 4 P7: "who's coming" — the coach's own attendee
-- identity list for their live/next Featured WOD session, mirroring
-- coach_workout_history's ownership-scoped pattern (nickname/role/joined_at)
-- rather than just the bare attendeeCount already on current_featured_wod().
--
-- Scoped to the calling coach's own schedule only: looks up
-- featured_wod_schedules by created_by = auth.uid(), never another coach's.
-- Finds that schedule's currently live/joinable session using the same
-- lookup current_featured_wod() uses (state IN ('waiting','work'), earliest
-- scheduled_at). Returns an empty/null result gracefully when the coach has
-- no schedule or no live session yet, rather than raising.
CREATE OR REPLACE FUNCTION public.coach_featured_wod_attendees()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_schedule public.featured_wod_schedules%ROWTYPE;
  v_session RECORD;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_schedule
  FROM public.featured_wod_schedules
  WHERE created_by = v_uid
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'sessionId', NULL, 'attendees', '[]'::jsonb);
  END IF;

  SELECT id, scheduled_at, state
  INTO v_session
  FROM public.sessions
  WHERE featured_schedule_id = v_schedule.id AND state IN ('waiting', 'work')
  ORDER BY scheduled_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'sessionId', NULL, 'attendees', '[]'::jsonb);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'sessionId', v_session.id,
    'attendees', (
      SELECT coalesce(jsonb_agg(a ORDER BY a.joined_at ASC), '[]'::jsonb)
      FROM (
        SELECT p.nickname, p.role, p.joined_at
        FROM public.participants p
        WHERE p.session_id = v_session.id
      ) a
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_featured_wod_attendees() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_featured_wod_attendees() TO authenticated;
