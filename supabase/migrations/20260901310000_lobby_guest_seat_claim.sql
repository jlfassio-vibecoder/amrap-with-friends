-- Guest seat claim tokens + redact auth UUIDs from anon get_lobby.
--
-- Copilot PR #56:
--   1/2. lobby_member_id alone was proof for guest reclaim/leave, but member ids
--        are visible in get_lobby. Mirror participants.claim_token_hash with a
--        per-seat secret returned only to the guest who owns the seat.
--   3. get_lobby still returned host_user_id / member user_id to anon. Table
--        enumeration was closed in 20260901300000; this redacts the RPC for anon.

ALTER TABLE public.lobby_members
  ADD COLUMN IF NOT EXISTS claim_token_hash text;

COMMENT ON COLUMN public.lobby_members.claim_token_hash IS
  'SHA-256 hex of guest seat_claim. NULL for claimed (auth) members.';


DROP FUNCTION IF EXISTS public.join_lobby(uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.join_lobby(
  p_lobby_id uuid,
  p_nickname text,
  p_lobby_member_id uuid DEFAULT NULL,
  p_seat_claim text DEFAULT NULL
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
  v_seat_claim text;
  v_seat_hash text;
  v_stored_hash text;
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

  v_seat_claim := NULL;

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
    -- Guest seat ownership is a secret (seat_claim), not the public member id.
    -- Member ids appear in get_lobby / Realtime for the roster; the claim does not.
    v_seat_claim := NULL;
    IF p_lobby_member_id IS NOT NULL AND p_seat_claim IS NOT NULL AND length(trim(p_seat_claim)) > 0 THEN
      v_seat_hash := encode(digest(trim(p_seat_claim), 'sha256'), 'hex');

      SELECT id, claim_token_hash
      INTO v_member_id, v_stored_hash
      FROM public.lobby_members
      WHERE id = p_lobby_member_id
        AND lobby_id = p_lobby_id
        AND user_id IS NULL
        AND status = 'active'
      FOR UPDATE;

      IF FOUND AND v_stored_hash IS NOT NULL AND v_stored_hash = v_seat_hash THEN
        v_seat_claim :=
          replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
        v_seat_hash := encode(digest(v_seat_claim, 'sha256'), 'hex');

        UPDATE public.lobby_members
        SET last_seen_at = now(),
            claim_token_hash = v_seat_hash
        WHERE id = v_member_id;
      ELSE
        v_member_id := NULL;
      END IF;
    END IF;

    IF v_member_id IS NULL THEN
      SELECT count(*)::int INTO v_member_count
      FROM public.lobby_members
      WHERE lobby_id = p_lobby_id AND status = 'active';

      IF v_member_count >= public.session_participant_limit() THEN
        RAISE EXCEPTION 'Lobby is full';
      END IF;

      v_seat_claim :=
        replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
      v_seat_hash := encode(digest(v_seat_claim, 'sha256'), 'hex');

      INSERT INTO public.lobby_members
        (lobby_id, user_id, nickname, status, last_seen_at, claim_token_hash)
      VALUES (p_lobby_id, NULL, v_nickname, 'active', now(), v_seat_hash)
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
    'host_token', v_host_token,
    'seat_claim', v_seat_claim
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.join_lobby(uuid, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_lobby(uuid, text, uuid, text) TO anon, authenticated;


-- ---------------------------------------------------------------------------
-- leave_lobby — guest leave requires seat_claim
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.leave_lobby(uuid, uuid);

CREATE OR REPLACE FUNCTION public.leave_lobby(
  p_lobby_id uuid,
  p_lobby_member_id uuid DEFAULT NULL,
  p_seat_claim text DEFAULT NULL
)
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
  v_seat_hash text;
BEGIN
  v_uid := auth.uid();

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

  IF v_uid IS NULL THEN
    IF p_lobby_member_id IS NULL
       OR p_seat_claim IS NULL
       OR length(trim(p_seat_claim)) = 0
    THEN
      RAISE EXCEPTION 'Lobby not found';
    END IF;

    v_seat_hash := encode(digest(trim(p_seat_claim), 'sha256'), 'hex');

    UPDATE public.lobby_members
    SET status = 'left'
    WHERE id = p_lobby_member_id
      AND lobby_id = p_lobby_id
      AND user_id IS NULL
      AND status = 'active'
      AND claim_token_hash IS NOT NULL
      AND claim_token_hash = v_seat_hash;

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    RETURN jsonb_build_object(
      'ok', true,
      'lobby_id', p_lobby_id,
      'left', v_updated > 0
    );
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
      UPDATE public.sessions
      SET state = 'finished', is_paused = false, time_left_sec = 0
      WHERE lobby_id = p_lobby_id
        AND state IN ('waiting', 'setup');

      UPDATE public.lobbies
      SET status = 'closed',
          active_session_id = NULL
      WHERE id = p_lobby_id;

      UPDATE public.lobby_members
      SET status = 'left'
      WHERE lobby_id = p_lobby_id
        AND status = 'active';

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

REVOKE EXECUTE ON FUNCTION public.leave_lobby(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_lobby(uuid, uuid, text) TO anon, authenticated;


-- ---------------------------------------------------------------------------
-- get_lobby — redact auth UUIDs for anonymous callers
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
  v_uid uuid;
  v_is_anon boolean;
BEGIN
  v_uid := auth.uid();
  v_is_anon := v_uid IS NULL;

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
        'user_id', CASE WHEN v_is_anon THEN NULL ELSE m.user_id END,
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
    'host_user_id', CASE WHEN v_is_anon THEN NULL ELSE v_lobby.host_user_id END,
    'active_session_id', v_lobby.active_session_id,
    'active_session_state', v_active_session_state,
    'status', v_lobby.status,
    'created_at', v_lobby.created_at,
    'updated_at', v_lobby.updated_at,
    'members', v_members
  );
END;
$$;
