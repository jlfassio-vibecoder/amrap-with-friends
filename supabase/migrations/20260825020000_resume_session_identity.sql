-- Restore lobby identity for authenticated users who claimed a session

CREATE OR REPLACE FUNCTION public.resume_session_identity(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_participant_id uuid;
  v_nickname text;
  v_role text;
  v_host_token text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_session_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT p.id, p.nickname, p.role
  INTO v_participant_id, v_nickname, v_role
  FROM public.participants p
  WHERE p.session_id = p_session_id
    AND p.user_id = v_uid
  ORDER BY p.joined_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_claimed');
  END IF;

  IF v_role = 'host' THEN
    SELECT s.host_token
    INTO v_host_token
    FROM public.sessions s
    WHERE s.id = p_session_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'participantId', v_participant_id,
    'nickname', v_nickname,
    'role', v_role,
    'hostToken', v_host_token
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resume_session_identity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resume_session_identity(uuid) TO authenticated;
