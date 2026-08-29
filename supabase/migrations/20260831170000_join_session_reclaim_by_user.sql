-- Reclaim existing participant by auth.uid() on join (Featured WOD host fix).
--
-- Featured sessions insert a host row with user_id = schedule.created_by, but
-- coaches re-enter via /join?s=… → join_session, which always INSERTed a new
-- joiner and never returned host_token. That produced duplicate "coach"
-- roster rows and "Waiting on host…" with no controls.
--
-- Also harden resume_session_identity to prefer the host row when a user has
-- both host and orphan joiner rows from prior buggy joins.

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
  v_uid uuid;
  v_count int;
  v_participant_id uuid;
  v_nickname text;
  v_existing_nickname text;
  v_role text;
  v_claim_token text;
  v_claim_hash text;
  v_host_token text;
  v_state text;
BEGIN
  v_uid := auth.uid();
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

  -- Authenticated reclaim: return the existing row (prefer host) instead of
  -- inserting another joiner. Allowed in any session state so the coach can
  -- reopen during setup/work after leaving the lobby.
  IF v_uid IS NOT NULL THEN
    SELECT p.id, p.nickname, p.role
    INTO v_participant_id, v_existing_nickname, v_role
    FROM public.participants p
    WHERE p.session_id = p_session_id
      AND p.user_id = v_uid
    ORDER BY CASE WHEN p.role = 'host' THEN 0 ELSE 1 END, p.joined_at ASC
    LIMIT 1;

    IF FOUND THEN
      -- Drop orphan joiner duplicates created by earlier unconditional joins.
      DELETE FROM public.participants
      WHERE session_id = p_session_id
        AND user_id = v_uid
        AND id <> v_participant_id;

      IF v_role = 'host' THEN
        SELECT s.host_token
        INTO v_host_token
        FROM public.sessions s
        WHERE s.id = p_session_id;
      END IF;

      RETURN jsonb_build_object(
        'participant_id', v_participant_id,
        'nickname', v_existing_nickname,
        'role', v_role,
        'claim_token', NULL,
        'host_token', v_host_token
      );
    END IF;
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

  INSERT INTO public.participants (session_id, nickname, role, claim_token_hash, user_id)
  VALUES (p_session_id, v_nickname, 'joiner', v_claim_hash, v_uid)
  RETURNING id INTO v_participant_id;

  RETURN jsonb_build_object(
    'participant_id', v_participant_id,
    'nickname', v_nickname,
    'role', 'joiner',
    'claim_token', v_claim_token,
    'host_token', NULL
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.join_session(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_session(uuid, text) TO anon, authenticated;

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
  ORDER BY CASE WHEN p.role = 'host' THEN 0 ELSE 1 END, p.joined_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_claimed');
  END IF;

  -- Clean orphan joiner duplicates so the roster shows one row for this user.
  DELETE FROM public.participants
  WHERE session_id = p_session_id
    AND user_id = v_uid
    AND id <> v_participant_id;

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
