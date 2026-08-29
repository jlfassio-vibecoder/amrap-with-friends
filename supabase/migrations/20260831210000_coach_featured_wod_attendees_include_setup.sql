-- Include setup-phase featured sessions in the coach attendee list.
-- setup was added after coach_featured_wod_attendees initially shipped with
-- waiting/work only; current_featured_wod already treats setup as live.
-- Copilot suggestion ignored: future-dated migration filenames are intentional sequencing IDs already applied on remote; renaming them would break history.

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
  WHERE featured_schedule_id = v_schedule.id
    AND state IN ('waiting', 'setup', 'work')
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
