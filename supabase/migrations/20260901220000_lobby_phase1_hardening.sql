-- Phase 1 lobby hardening: no host_token to the wrong caller, Pass Command
-- cannot soft-lock, refuse pass during live work, start_next TOCTOU after lock.

CREATE INDEX IF NOT EXISTS idx_lobby_members_lobby_active
  ON public.lobby_members (lobby_id)
  WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- pass_lobby_command
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pass_lobby_command(
  p_lobby_id uuid,
  p_to_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_lobby public.lobbies%ROWTYPE;
  v_session_state text;
  v_target_nickname text;
  v_target_participant uuid;
  v_claim_token text;
  v_claim_hash text;
  v_rotated text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_lobby_id IS NULL OR p_to_user_id IS NULL THEN
    RAISE EXCEPTION 'Lobby not found';
  END IF;

  IF p_to_user_id = v_uid THEN
    RAISE EXCEPTION 'Cannot pass command to yourself';
  END IF;

  SELECT * INTO v_lobby
  FROM public.lobbies
  WHERE id = p_lobby_id
  FOR UPDATE;

  IF NOT FOUND OR v_lobby.status <> 'open' THEN
    RAISE EXCEPTION 'Lobby not found';
  END IF;

  IF v_lobby.host_user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Only the host can pass command';
  END IF;

  SELECT nickname INTO v_target_nickname
  FROM public.lobby_members
  WHERE lobby_id = p_lobby_id
    AND user_id = p_to_user_id
    AND status = 'active'
  LIMIT 1;

  IF v_target_nickname IS NULL THEN
    RAISE EXCEPTION 'Target is not an active crew member';
  END IF;

  IF v_lobby.active_session_id IS NOT NULL THEN
    SELECT state INTO v_session_state
    FROM public.sessions
    WHERE id = v_lobby.active_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
      v_session_state := NULL;
    ELSIF v_session_state = 'work' THEN
      RAISE EXCEPTION 'Cannot pass command during a live session';
    ELSIF v_session_state IN ('waiting', 'setup') THEN
      SELECT id INTO v_target_participant
      FROM public.participants
      WHERE session_id = v_lobby.active_session_id
        AND user_id = p_to_user_id
      ORDER BY joined_at ASC
      LIMIT 1;

      IF v_target_participant IS NULL THEN
        v_claim_token :=
          replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
        v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

        INSERT INTO public.participants (session_id, nickname, role, claim_token_hash, user_id)
        VALUES (
          v_lobby.active_session_id,
          v_target_nickname,
          'joiner',
          v_claim_hash,
          p_to_user_id
        );
      END IF;

      UPDATE public.lobbies
      SET host_user_id = p_to_user_id
      WHERE id = p_lobby_id;

      v_rotated := public._lobby_rotate_waiting_host(v_lobby.active_session_id, p_to_user_id);
      IF v_rotated IS NULL THEN
        RAISE EXCEPTION 'Cannot pass command during a live session';
      END IF;
    ELSIF v_session_state = 'finished' THEN
      UPDATE public.lobbies
      SET host_user_id = p_to_user_id
      WHERE id = p_lobby_id;
    ELSE
      RAISE EXCEPTION 'Cannot pass command during a live session';
    END IF;
  ELSE
    UPDATE public.lobbies
    SET host_user_id = p_to_user_id
    WHERE id = p_lobby_id;
  END IF;

  -- Never return the rotated token to the outgoing host.
  RETURN jsonb_build_object(
    'ok', true,
    'lobby_id', p_lobby_id,
    'host_user_id', p_to_user_id,
    'active_session_id', v_lobby.active_session_id,
    'host_token', NULL
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pass_lobby_command(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pass_lobby_command(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- leave_lobby — never return successor host_token to the leaver
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.leave_lobby(p_lobby_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_lobby public.lobbies%ROWTYPE;
  v_successor uuid;
  v_was_host boolean := false;
  v_updated int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_lobby_id IS NULL THEN
    RAISE EXCEPTION 'Lobby not found';
  END IF;

  SELECT * INTO v_lobby
  FROM public.lobbies
  WHERE id = p_lobby_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lobby not found';
  END IF;

  UPDATE public.lobby_members
  SET status = 'left'
  WHERE lobby_id = p_lobby_id
    AND user_id = v_uid
    AND status = 'active';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', true, 'lobby_id', p_lobby_id, 'left', false);
  END IF;

  IF v_lobby.host_user_id = v_uid AND v_lobby.status = 'open' THEN
    v_was_host := true;
    v_successor := public._lobby_pick_successor(p_lobby_id, v_uid);

    IF v_successor IS NULL THEN
      UPDATE public.lobbies
      SET status = 'closed',
          active_session_id = NULL
      WHERE id = p_lobby_id;

      RETURN jsonb_build_object(
        'ok', true,
        'lobby_id', p_lobby_id,
        'left', true,
        'closed', true
      );
    END IF;

    UPDATE public.lobbies
    SET host_user_id = v_successor
    WHERE id = p_lobby_id;

    PERFORM public._lobby_rotate_waiting_host(v_lobby.active_session_id, v_successor);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'lobby_id', p_lobby_id,
    'left', true,
    'was_host', v_was_host,
    'host_user_id', coalesce(v_successor, v_lobby.host_user_id)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.leave_lobby(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_lobby(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- start_next_lobby_session — re-check host after lock (TOCTOU)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.start_next_lobby_session(
  p_lobby_id uuid,
  p_duration_minutes int,
  p_workout jsonb,
  p_template_id text,
  p_intensity_tier int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_lobby public.lobbies%ROWTYPE;
  v_prior_state text;
  v_session_id uuid;
  v_host_token text;
  v_participant_id uuid;
  v_template_id text;
  v_intensity_tier int;
  v_active int;
  v_member record;
  v_role text;
  v_claim_token text;
  v_claim_hash text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_lobby_id IS NULL THEN
    RAISE EXCEPTION 'Lobby not found';
  END IF;

  SELECT * INTO v_lobby
  FROM public.lobbies
  WHERE id = p_lobby_id
  FOR UPDATE;

  IF NOT FOUND OR v_lobby.status <> 'open' THEN
    RAISE EXCEPTION 'Lobby not found';
  END IF;

  -- Re-check after lock so a concurrent Pass Command cannot lose the race.
  IF v_lobby.host_user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Only the host can start the next session';
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes < 1 OR p_duration_minutes > 60 THEN
    RAISE EXCEPTION 'Duration must be between 1 and 60 minutes';
  END IF;

  IF NOT public.validate_workout(p_workout) THEN
    RAISE EXCEPTION 'Invalid workout format';
  END IF;

  v_template_id := NULL;
  IF p_template_id IS NOT NULL THEN
    v_template_id := trim(p_template_id);
    IF v_template_id = '' OR length(v_template_id) > 120 THEN
      RAISE EXCEPTION 'Invalid template id';
    END IF;
  END IF;

  v_intensity_tier := NULL;
  IF p_intensity_tier IS NOT NULL THEN
    IF p_intensity_tier < 1 OR p_intensity_tier > 5 THEN
      RAISE EXCEPTION 'Intensity tier must be between 1 and 5';
    END IF;
    v_intensity_tier := p_intensity_tier;
  END IF;

  IF v_lobby.active_session_id IS NOT NULL THEN
    SELECT state INTO v_prior_state
    FROM public.sessions
    WHERE id = v_lobby.active_session_id
    FOR UPDATE;

    IF FOUND AND v_prior_state IS DISTINCT FROM 'finished' THEN
      RAISE EXCEPTION 'Current session is still active';
    END IF;
  END IF;

  -- Host may have changed under concurrent claim/pass; re-read.
  SELECT host_user_id INTO v_lobby.host_user_id
  FROM public.lobbies
  WHERE id = p_lobby_id;

  IF v_lobby.host_user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Only the host can start the next session';
  END IF;

  SELECT count(*)::int
  INTO v_active
  FROM public.sessions s
  JOIN public.participants p
    ON p.session_id = s.id
   AND p.role = 'host'
   AND p.user_id = v_uid
  WHERE s.state IN ('waiting', 'setup', 'work')
    AND s.is_featured = false
    AND s.campaign_occurrence_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.campaign_makeups m WHERE m.session_id = s.id
    );

  IF v_active >= 3 THEN
    RAISE EXCEPTION 'Host session limit reached';
  END IF;

  v_host_token := gen_random_uuid()::text;

  INSERT INTO public.sessions (
    host_token,
    duration_minutes,
    workout,
    template_id,
    intensity_tier,
    state,
    time_left_sec,
    lobby_id
  )
  VALUES (
    v_host_token,
    p_duration_minutes,
    p_workout,
    v_template_id,
    v_intensity_tier,
    'waiting',
    10,
    p_lobby_id
  )
  RETURNING id INTO v_session_id;

  UPDATE public.lobbies
  SET active_session_id = v_session_id
  WHERE id = p_lobby_id;

  v_participant_id := NULL;
  FOR v_member IN
    SELECT *
    FROM public.lobby_members
    WHERE lobby_id = p_lobby_id
      AND status = 'active'
      AND user_id IS NOT NULL
    ORDER BY joined_at ASC
  LOOP
    v_role := CASE
      WHEN v_member.user_id IS NOT NULL AND v_member.user_id = v_uid THEN 'host'
      ELSE 'joiner'
    END;

    v_claim_token :=
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

    INSERT INTO public.participants (session_id, nickname, role, claim_token_hash, user_id)
    VALUES (v_session_id, v_member.nickname, v_role, v_claim_hash, v_member.user_id);

    IF v_role = 'host' THEN
      SELECT id INTO v_participant_id
      FROM public.participants
      WHERE session_id = v_session_id
        AND user_id = v_uid
        AND role = 'host'
      LIMIT 1;
    END IF;
  END LOOP;

  IF v_participant_id IS NULL THEN
    SELECT id INTO v_participant_id
    FROM public.participants
    WHERE session_id = v_session_id
      AND user_id = v_uid
      AND role = 'host'
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'lobby_id', p_lobby_id,
    'session_id', v_session_id,
    'host_token', v_host_token,
    'participant_id', v_participant_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.start_next_lobby_session(uuid, int, jsonb, text, int)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_next_lobby_session(uuid, int, jsonb, text, int)
  TO authenticated;
