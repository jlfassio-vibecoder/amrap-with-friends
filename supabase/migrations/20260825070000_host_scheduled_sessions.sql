CREATE OR REPLACE FUNCTION public.host_scheduled_sessions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_sessions jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'session_id', s.id,
        'scheduled_at', s.scheduled_at,
        'created_at', s.created_at,
        'duration_minutes', s.duration_minutes,
        'workout', s.workout,
        'state', s.state
      )
      ORDER BY s.scheduled_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_sessions
  FROM public.sessions s
  INNER JOIN public.participants p
    ON p.session_id = s.id
   AND p.role = 'host'
   AND p.user_id = v_uid
  WHERE s.scheduled_at IS NOT NULL
    AND s.state IN ('waiting', 'setup', 'work');

  RETURN jsonb_build_object('ok', true, 'sessions', v_sessions);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.host_scheduled_sessions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.host_scheduled_sessions() TO authenticated;
