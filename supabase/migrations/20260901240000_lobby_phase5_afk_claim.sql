-- Phase 5 AFK claim: stale-aware successor; claim aligned with Pass Command
-- (refuse work; ensure participant + rotate or rollback).

-- ---------------------------------------------------------------------------
-- _lobby_pick_successor
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._lobby_pick_successor(
  p_lobby_id uuid,
  p_exclude_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_grace interval := interval '45 seconds';
BEGIN
  -- Prefer earliest joined active claimed member who is still fresh.
  SELECT m.user_id
  INTO v_uid
  FROM public.lobby_members m
  WHERE m.lobby_id = p_lobby_id
    AND m.status = 'active'
    AND m.user_id IS NOT NULL
    AND m.user_id IS DISTINCT FROM p_exclude_user_id
    AND m.last_seen_at IS NOT NULL
    AND m.last_seen_at > (now() - v_grace)
  ORDER BY m.joined_at ASC
  LIMIT 1;

  IF v_uid IS NOT NULL THEN
    RETURN v_uid;
  END IF;

  -- Fall back to earliest active claimed member if everyone else is stale.
  SELECT m.user_id
  INTO v_uid
  FROM public.lobby_members m
  WHERE m.lobby_id = p_lobby_id
    AND m.status = 'active'
    AND m.user_id IS NOT NULL
    AND m.user_id IS DISTINCT FROM p_exclude_user_id
  ORDER BY m.joined_at ASC
  LIMIT 1;

  RETURN v_uid;
END;
$$;

-- ---------------------------------------------------------------------------
-- claim_lobby_command_if_stale
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_lobby_command_if_stale(p_lobby_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_lobby public.lobbies%ROWTYPE;
  v_host_seen timestamptz;
  v_host_status text;
  v_grace interval := interval '45 seconds';
  v_host_token text;
  v_successor uuid;
  v_session_state text;
  v_nickname text;
  v_participant_id uuid;
  v_claim_token text;
  v_claim_hash text;
  v_rotated text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_lobby
  FROM public.lobbies
  WHERE id = p_lobby_id
  FOR UPDATE;

  IF NOT FOUND OR v_lobby.status <> 'open' THEN
    RAISE EXCEPTION 'Lobby not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.lobby_members
    WHERE lobby_id = p_lobby_id
      AND user_id = v_uid
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not a lobby member';
  END IF;

  IF v_lobby.host_user_id = v_uid THEN
    RETURN jsonb_build_object(
      'ok', true,
      'claimed', false,
      'host_user_id', v_uid,
      'reason', 'already_host'
    );
  END IF;

  SELECT last_seen_at, status
  INTO v_host_seen, v_host_status
  FROM public.lobby_members
  WHERE lobby_id = p_lobby_id
    AND user_id = v_lobby.host_user_id
  ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, joined_at DESC
  LIMIT 1;

  IF v_host_status IS DISTINCT FROM 'left'
     AND v_host_seen IS NOT NULL
     AND v_host_seen > (now() - v_grace)
  THEN
    RETURN jsonb_build_object(
      'ok', true,
      'claimed', false,
      'host_user_id', v_lobby.host_user_id,
      'reason', 'host_present'
    );
  END IF;

  v_successor := public._lobby_pick_successor(p_lobby_id, v_lobby.host_user_id);
  IF v_successor IS NULL THEN
    RAISE EXCEPTION 'No successor available';
  END IF;

  IF v_successor IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object(
      'ok', true,
      'claimed', false,
      'host_user_id', v_lobby.host_user_id,
      'successor_user_id', v_successor,
      'reason', 'not_successor'
    );
  END IF;

  SELECT nickname INTO v_nickname
  FROM public.lobby_members
  WHERE lobby_id = p_lobby_id
    AND user_id = v_uid
    AND status = 'active'
  LIMIT 1;

  IF v_nickname IS NULL THEN
    RAISE EXCEPTION 'Not a lobby member';
  END IF;

  v_host_token := NULL;

  IF v_lobby.active_session_id IS NOT NULL THEN
    SELECT state INTO v_session_state
    FROM public.sessions
    WHERE id = v_lobby.active_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
      v_session_state := NULL;
    ELSIF v_session_state = 'work' THEN
      RAISE EXCEPTION 'Cannot claim command during a live session';
    ELSIF v_session_state IN ('waiting', 'setup') THEN
      SELECT id INTO v_participant_id
      FROM public.participants
      WHERE session_id = v_lobby.active_session_id
        AND user_id = v_uid
      ORDER BY joined_at ASC
      LIMIT 1;

      IF v_participant_id IS NULL THEN
        v_claim_token :=
          replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
        v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

        INSERT INTO public.participants (session_id, nickname, role, claim_token_hash, user_id)
        VALUES (
          v_lobby.active_session_id,
          v_nickname,
          'joiner',
          v_claim_hash,
          v_uid
        );
      END IF;

      UPDATE public.lobbies
      SET host_user_id = v_uid
      WHERE id = p_lobby_id;

      v_rotated := public._lobby_rotate_waiting_host(v_lobby.active_session_id, v_uid);
      IF v_rotated IS NULL THEN
        RAISE EXCEPTION 'Cannot claim command during a live session';
      END IF;
      v_host_token := v_rotated;
    ELSIF v_session_state = 'finished' THEN
      UPDATE public.lobbies
      SET host_user_id = v_uid
      WHERE id = p_lobby_id;
    ELSE
      RAISE EXCEPTION 'Cannot claim command during a live session';
    END IF;
  ELSE
    UPDATE public.lobbies
    SET host_user_id = v_uid
    WHERE id = p_lobby_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'claimed', true,
    'lobby_id', p_lobby_id,
    'host_user_id', v_uid,
    'active_session_id', v_lobby.active_session_id,
    'host_token', v_host_token
  );
END;
$$;
