-- Phase 6: finish orphan waiting/setup sessions when a lobby closes so they
-- no longer count toward the host's 3-active cap; exclude closed-lobby seats
-- from start_next's cap predicate as belt-and-suspenders.

-- ---------------------------------------------------------------------------
-- leave_lobby — finish waiting/setup orphans on auto-close
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
      UPDATE public.sessions
      SET state = 'finished', is_paused = false, time_left_sec = 0
      WHERE lobby_id = p_lobby_id
        AND state IN ('waiting', 'setup');

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
-- close_lobby — finish waiting/setup orphans
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.close_lobby(p_lobby_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_lobby public.lobbies%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_lobby
  FROM public.lobbies
  WHERE id = p_lobby_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lobby not found';
  END IF;

  IF v_lobby.host_user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Only the host can close the staging area';
  END IF;

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

  RETURN jsonb_build_object('ok', true, 'lobby_id', p_lobby_id, 'status', 'closed');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.close_lobby(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_lobby(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- start_next_lobby_session — exclude closed-lobby seats from host cap
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
    )
    AND (
      s.lobby_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.lobbies l
        WHERE l.id = s.lobby_id
          AND l.status = 'open'
      )
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
