CREATE OR REPLACE FUNCTION public.update_session_scheduled_at(
  p_session_id uuid,
  p_scheduled_at timestamptz,
  p_timezone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_state text;
  v_existing_scheduled_at timestamptz;
  v_timezone text;
  v_today date;
  v_rally_date date;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'Session id is required';
  END IF;

  IF p_scheduled_at IS NULL THEN
    RAISE EXCEPTION 'Rally time is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.participants p
    WHERE p.session_id = p_session_id
      AND p.user_id = v_uid
      AND p.role = 'host'
  ) THEN
    RAISE EXCEPTION 'Only the host can update rally time';
  END IF;

  SELECT s.state, s.scheduled_at
  INTO v_state, v_existing_scheduled_at
  FROM public.sessions s
  WHERE s.id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF v_existing_scheduled_at IS NULL THEN
    RAISE EXCEPTION 'Session has no scheduled rally time';
  END IF;

  IF v_state <> 'waiting' THEN
    RAISE EXCEPTION 'Session is not waiting';
  END IF;

  v_timezone := btrim(p_timezone);
  IF v_timezone IS NULL
     OR v_timezone = ''
     OR NOT EXISTS (
       SELECT 1
       FROM pg_timezone_names
       WHERE name = v_timezone
     )
  THEN
    RAISE EXCEPTION 'invalid_timezone';
  END IF;

  IF p_scheduled_at <= now() THEN
    RAISE EXCEPTION 'Rally time must be in the future';
  END IF;

  v_today := (now() AT TIME ZONE v_timezone)::date;
  v_rally_date := (p_scheduled_at AT TIME ZONE v_timezone)::date;

  IF v_rally_date < v_today OR v_rally_date > (v_today + 1) THEN
    RAISE EXCEPTION 'Rally time must be today or tomorrow';
  END IF;

  UPDATE public.sessions
  SET scheduled_at = p_scheduled_at,
      lobby_countdown_ends_at = NULL
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'ok', true,
    'scheduled_at', p_scheduled_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_session_scheduled_at(uuid, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_session_scheduled_at(uuid, timestamptz, text) TO authenticated;
