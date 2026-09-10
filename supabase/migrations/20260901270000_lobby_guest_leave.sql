-- A guest can leave, and a closed lobby holds no active seats.
--
-- Two halves of the same gap:
--
--   1. leave_lobby opened with an auth.uid() null check, so a guest had no exit
--      at all. The staging page shows "Leave staging" to everyone, swallowed the
--      resulting error and navigated home anyway -- so the control appeared to
--      work while the seat stayed active for ever.
--   2. When the host leaves and _lobby_pick_successor finds nobody, leave_lobby
--      closes the lobby but never swept the roster -- unlike close_lobby, which
--      marks every remaining member left. A guest therefore stayed 'active' in a
--      closed lobby.
--
-- Guests leave the same way they re-join: with the member id they were handed,
-- scoped to an active guest seat in this lobby so a borrowed or stale id cannot
-- evict anyone. A guest never holds command, so no succession runs.
--
-- Dropped and recreated rather than replaced, so the one-argument version does
-- not linger as an overload -- that is how create_session became ambiguous.

DROP FUNCTION IF EXISTS public.leave_lobby(uuid);

CREATE OR REPLACE FUNCTION public.leave_lobby(
  p_lobby_id uuid,
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
  v_successor uuid;
  v_was_host boolean := false;
  v_updated int;
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
    -- A guest has no user_id to match on, so it leaves by the member id it was
    -- handed on join. Scoped to an active guest seat in this lobby, so a
    -- borrowed or stale id cannot evict anyone.
    IF p_lobby_member_id IS NULL THEN
      RAISE EXCEPTION 'Lobby not found';
    END IF;

    UPDATE public.lobby_members
    SET status = 'left'
    WHERE id = p_lobby_member_id
      AND lobby_id = p_lobby_id
      AND user_id IS NULL
      AND status = 'active';

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    -- A guest never holds command, so there is no succession to run.
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

      -- Same sweep close_lobby does. Without it a closed lobby kept every guest
      -- marked active for ever, since _lobby_pick_successor only considers
      -- claimed members and nothing else ever cleared them.
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
REVOKE EXECUTE ON FUNCTION public.leave_lobby(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_lobby(uuid, uuid) TO anon, authenticated;
