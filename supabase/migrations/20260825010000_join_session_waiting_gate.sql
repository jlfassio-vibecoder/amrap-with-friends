-- Phase 6: Rally Point — reject joins after the lobby has departed

CREATE OR REPLACE FUNCTION public.join_session(
  p_session_id uuid,
  p_nickname text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_count int;
  v_participant_id uuid;
  v_nickname text;
  v_claim_token text;
  v_claim_hash text;
  v_state text;
BEGIN
  v_nickname := trim(p_nickname);
  IF v_nickname IS NULL OR v_nickname = '' OR length(v_nickname) > 50 THEN
    RAISE EXCEPTION 'Name or nickname is required (max 50 characters)';
  END IF;

  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  SELECT state
  INTO v_state
  FROM public.sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF v_state IS DISTINCT FROM 'waiting' THEN
    RAISE EXCEPTION 'Session locked';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.participants
  WHERE session_id = p_session_id;

  IF v_count >= 100 THEN
    RAISE EXCEPTION 'Session is full';
  END IF;

  v_claim_token :=
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

  INSERT INTO public.participants (session_id, nickname, role, claim_token_hash)
  VALUES (p_session_id, v_nickname, 'joiner', v_claim_hash)
  RETURNING id INTO v_participant_id;

  RETURN jsonb_build_object(
    'participant_id', v_participant_id,
    'claim_token', v_claim_token
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.join_session(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_session(uuid, text) TO anon, authenticated;
