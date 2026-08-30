-- One participant limit, and a refusal that names the real reason.
--
-- Finding 4 -- the epic asked for "lobby member count aligned with session max
-- (6)". The premise was stale: the session cap was raised from 6 to 100 in
-- 20260822160000_raise_participant_cap.sql, and join_lobby already matches that
-- number. So the number is right and setting it to 6 would undo a deliberate
-- decision -- but it is right by coincidence, because 100 is a literal repeated
-- in both places. The alignment the epic wanted is a shared limit that cannot
-- drift, which is how campaign_member_limit() and squad_friend_limit() already
-- do it.
--
-- Finding 5 -- pass_lobby_command checked "not yourself" before "you are the
-- host", so a demoted host passing to themselves was told the wrong thing.

CREATE OR REPLACE FUNCTION public.session_participant_limit()
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, extensions
AS $$ SELECT 100 $$;

-- ---------------------------------------------------------------------------
-- join_session -- the session side of the limit
-- ---------------------------------------------------------------------------

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

  IF v_count >= public.session_participant_limit() THEN
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

-- ---------------------------------------------------------------------------
-- join_lobby -- the lobby side, member seats and session seats alike
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.join_lobby(
  p_lobby_id uuid,
  p_nickname text,
  p_lobby_member_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_lobby public.lobbies%ROWTYPE;
  v_nickname text;
  v_member_id uuid;
  v_existing_nickname text;
  v_member_count int;
  v_session_id uuid;
  v_session_state text;
  v_participant_id uuid;
  v_role text;
  v_claim_token text;
  v_claim_hash text;
  v_host_token text;
  v_part_count int;
BEGIN
  v_uid := auth.uid();
  v_nickname := trim(p_nickname);
  IF v_nickname IS NULL OR v_nickname = '' OR length(v_nickname) > 50 THEN
    RAISE EXCEPTION 'Name or nickname is required (max 50 characters)';
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

  IF v_lobby.status <> 'open' THEN
    RAISE EXCEPTION 'Lobby closed';
  END IF;

  -- Reclaim active membership for authenticated users.
  IF v_uid IS NOT NULL THEN
    SELECT id, nickname
    INTO v_member_id, v_existing_nickname
    FROM public.lobby_members
    WHERE lobby_id = p_lobby_id
      AND user_id = v_uid
      AND status = 'active'
    ORDER BY joined_at ASC
    LIMIT 1;

    IF FOUND THEN
      UPDATE public.lobby_members
      SET last_seen_at = now(), nickname = coalesce(nullif(v_existing_nickname, ''), v_nickname)
      WHERE id = v_member_id;
    ELSE
      -- Reactivate a prior left row when present.
      SELECT id INTO v_member_id
      FROM public.lobby_members
      WHERE lobby_id = p_lobby_id
        AND user_id = v_uid
        AND status = 'left'
      ORDER BY joined_at DESC
      LIMIT 1;

      IF FOUND THEN
        UPDATE public.lobby_members
        SET status = 'active',
            nickname = v_nickname,
            last_seen_at = now(),
            joined_at = now()
        WHERE id = v_member_id;
      ELSE
        SELECT count(*)::int INTO v_member_count
        FROM public.lobby_members
        WHERE lobby_id = p_lobby_id AND status = 'active';

        IF v_member_count >= public.session_participant_limit() THEN
          RAISE EXCEPTION 'Lobby is full';
        END IF;

        INSERT INTO public.lobby_members (lobby_id, user_id, nickname, status, last_seen_at)
        VALUES (p_lobby_id, v_uid, v_nickname, 'active', now())
        RETURNING id INTO v_member_id;
      END IF;
    END IF;
  ELSE
    -- A guest has no user_id to match on, so the client hands back the member id
    -- it was given the first time. Without this every re-join minted a new seat,
    -- and start_next_lobby_session guarantees a re-join on every chained mission.
    IF p_lobby_member_id IS NOT NULL THEN
      SELECT id INTO v_member_id
      FROM public.lobby_members
      WHERE id = p_lobby_member_id
        AND lobby_id = p_lobby_id
        AND user_id IS NULL
        AND status = 'active'
      FOR UPDATE;

      IF FOUND THEN
        UPDATE public.lobby_members
        SET last_seen_at = now()
        WHERE id = v_member_id;
      END IF;
    END IF;

    IF v_member_id IS NULL THEN
      SELECT count(*)::int INTO v_member_count
      FROM public.lobby_members
      WHERE lobby_id = p_lobby_id AND status = 'active';

      IF v_member_count >= public.session_participant_limit() THEN
        RAISE EXCEPTION 'Lobby is full';
      END IF;

      INSERT INTO public.lobby_members (lobby_id, user_id, nickname, status, last_seen_at)
      VALUES (p_lobby_id, NULL, v_nickname, 'active', now())
      RETURNING id INTO v_member_id;
    END IF;
  END IF;

  v_session_id := v_lobby.active_session_id;
  v_participant_id := NULL;
  v_role := NULL;
  v_claim_token := NULL;
  v_host_token := NULL;
  v_session_state := NULL;

  IF v_session_id IS NOT NULL THEN
    SELECT state INTO v_session_state
    FROM public.sessions
    WHERE id = v_session_id
    FOR UPDATE;

    IF FOUND THEN
      IF v_uid IS NOT NULL THEN
        SELECT p.id, p.role
        INTO v_participant_id, v_role
        FROM public.participants p
        WHERE p.session_id = v_session_id
          AND p.user_id = v_uid
        ORDER BY CASE WHEN p.role = 'host' THEN 0 ELSE 1 END, p.joined_at ASC
        LIMIT 1;

        IF FOUND THEN
          DELETE FROM public.participants
          WHERE session_id = v_session_id
            AND user_id = v_uid
            AND id <> v_participant_id;

          IF v_session_state IN ('waiting', 'setup', 'work') THEN
            v_claim_token :=
              replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
            v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

            UPDATE public.participants
            SET claim_token_hash = v_claim_hash,
                nickname = coalesce(nullif(nickname, ''), v_nickname)
            WHERE id = v_participant_id;
          END IF;

          IF v_role = 'host' THEN
            SELECT host_token INTO v_host_token
            FROM public.sessions
            WHERE id = v_session_id;
          END IF;
        ELSIF v_session_state = 'waiting' THEN
          SELECT count(*) INTO v_part_count
          FROM public.participants
          WHERE session_id = v_session_id;

          IF v_part_count >= public.session_participant_limit() THEN
            RAISE EXCEPTION 'Session is full';
          END IF;

          v_claim_token :=
            replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
          v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

          INSERT INTO public.participants
            (session_id, nickname, role, claim_token_hash, user_id, lobby_member_id)
          VALUES (v_session_id, v_nickname, 'joiner', v_claim_hash, v_uid, v_member_id)
          RETURNING id INTO v_participant_id;

          v_role := 'joiner';
        END IF;
      ELSE
        -- start_next_lobby_session now seeds guests, so look for the seat this
        -- member already holds before making another one.
        SELECT p.id, p.role
        INTO v_participant_id, v_role
        FROM public.participants p
        WHERE p.session_id = v_session_id
          AND p.lobby_member_id = v_member_id
        LIMIT 1;

        IF FOUND THEN
          IF v_session_state IN ('waiting', 'setup', 'work') THEN
            v_claim_token :=
              replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
            v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

            UPDATE public.participants
            SET claim_token_hash = v_claim_hash,
                nickname = coalesce(nullif(nickname, ''), v_nickname)
            WHERE id = v_participant_id;
          END IF;
        ELSIF v_session_state = 'waiting' THEN
          SELECT count(*) INTO v_part_count
          FROM public.participants
          WHERE session_id = v_session_id;

          IF v_part_count >= public.session_participant_limit() THEN
            RAISE EXCEPTION 'Session is full';
          END IF;

          v_claim_token :=
            replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
          v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

          INSERT INTO public.participants
            (session_id, nickname, role, claim_token_hash, user_id, lobby_member_id)
          VALUES (v_session_id, v_nickname, 'joiner', v_claim_hash, NULL, v_member_id)
          RETURNING id INTO v_participant_id;

          v_role := 'joiner';
        END IF;
      END IF;
    ELSE
      v_session_state := NULL;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'lobby_id', p_lobby_id,
    'lobby_member_id', v_member_id,
    'host_user_id', v_lobby.host_user_id,
    'status', v_lobby.status,
    'active_session_id', v_session_id,
    'session_id', v_session_id,
    'session_state', v_session_state,
    'participant_id', v_participant_id,
    'nickname', v_nickname,
    'role', v_role,
    'claim_token', v_claim_token,
    'host_token', v_host_token
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.join_lobby(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_lobby(uuid, text, uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- pass_lobby_command -- authority before etiquette
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

  -- Checked after authority, not before it: a demoted host passing to themselves
  -- was told "Cannot pass command to yourself" when the real answer is that they
  -- no longer hold command. Refused either way; the message was just wrong.
  IF p_to_user_id = v_uid THEN
    RAISE EXCEPTION 'Cannot pass command to yourself';
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
