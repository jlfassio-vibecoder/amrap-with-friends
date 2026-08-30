-- Phase 2 lobby routing: join_lobby reissues claim on reclaim + session_state;
-- get_lobby returns active_session_state so clients avoid direct table reads.

-- ---------------------------------------------------------------------------
-- join_lobby
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.join_lobby(
  p_lobby_id uuid,
  p_nickname text
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

        IF v_member_count >= 100 THEN
          RAISE EXCEPTION 'Lobby is full';
        END IF;

        INSERT INTO public.lobby_members (lobby_id, user_id, nickname, status, last_seen_at)
        VALUES (p_lobby_id, v_uid, v_nickname, 'active', now())
        RETURNING id INTO v_member_id;
      END IF;
    END IF;
  ELSE
    SELECT count(*)::int INTO v_member_count
    FROM public.lobby_members
    WHERE lobby_id = p_lobby_id AND status = 'active';

    IF v_member_count >= 100 THEN
      RAISE EXCEPTION 'Lobby is full';
    END IF;

    INSERT INTO public.lobby_members (lobby_id, user_id, nickname, status, last_seen_at)
    VALUES (p_lobby_id, NULL, v_nickname, 'active', now())
    RETURNING id INTO v_member_id;
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

          IF v_part_count >= 100 THEN
            RAISE EXCEPTION 'Session is full';
          END IF;

          v_claim_token :=
            replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
          v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

          INSERT INTO public.participants (session_id, nickname, role, claim_token_hash, user_id)
          VALUES (v_session_id, v_nickname, 'joiner', v_claim_hash, v_uid)
          RETURNING id INTO v_participant_id;

          v_role := 'joiner';
        END IF;
      ELSIF v_session_state = 'waiting' THEN
        SELECT count(*) INTO v_part_count
        FROM public.participants
        WHERE session_id = v_session_id;

        IF v_part_count >= 100 THEN
          RAISE EXCEPTION 'Session is full';
        END IF;

        v_claim_token :=
          replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
        v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

        INSERT INTO public.participants (session_id, nickname, role, claim_token_hash, user_id)
        VALUES (v_session_id, v_nickname, 'joiner', v_claim_hash, NULL)
        RETURNING id INTO v_participant_id;

        v_role := 'joiner';
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

-- ---------------------------------------------------------------------------
-- get_lobby
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_lobby(p_lobby_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_lobby public.lobbies%ROWTYPE;
  v_members jsonb;
  v_active_session_state text;
BEGIN
  IF p_lobby_id IS NULL THEN
    RAISE EXCEPTION 'Lobby not found';
  END IF;

  SELECT * INTO v_lobby FROM public.lobbies WHERE id = p_lobby_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lobby not found';
  END IF;

  v_active_session_state := NULL;
  IF v_lobby.active_session_id IS NOT NULL THEN
    SELECT state INTO v_active_session_state
    FROM public.sessions
    WHERE id = v_lobby.active_session_id;
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'user_id', m.user_id,
        'nickname', m.nickname,
        'status', m.status,
        'last_seen_at', m.last_seen_at,
        'joined_at', m.joined_at
      )
      ORDER BY m.joined_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_members
  FROM public.lobby_members m
  WHERE m.lobby_id = p_lobby_id
    AND m.status = 'active';

  RETURN jsonb_build_object(
    'ok', true,
    'lobby_id', v_lobby.id,
    'host_user_id', v_lobby.host_user_id,
    'active_session_id', v_lobby.active_session_id,
    'active_session_state', v_active_session_state,
    'status', v_lobby.status,
    'created_at', v_lobby.created_at,
    'updated_at', v_lobby.updated_at,
    'members', v_members
  );
END;
$$;
