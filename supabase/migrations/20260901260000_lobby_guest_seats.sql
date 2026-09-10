-- Guests keep one seat per lobby, and get one in every chained mission.
--
-- Three correct-looking pieces combined into a compounding defect:
--
--   1. start_next_lobby_session seeded participants from lobby_members filtered
--      by user_id IS NOT NULL, so guests got no seat in the next mission.
--   2. useLobbyForceNav refuses to navigate without a seat, so it calls
--      join_lobby to recover one -- which, for a guest, fires on every single
--      chained mission because (1) guarantees they never have one.
--   3. join_lobby had no way to recognise a returning guest: the unique index is
--      (lobby_id, user_id) WHERE user_id IS NOT NULL, so it inserted a fresh
--      member row every time.
--
-- Net effect: one new lobby_members row per guest per mission. After four
-- missions a single guest appeared four times in the staging roster, and
-- get_lobby handed the duplicates straight to the client.
--
-- The filter in (1) was added deliberately, to stop guests duplicating. It is
-- what caused the duplication, because the recovery path re-joins them.
--
-- Fix: give a guest a stable identity to come back with. participants gains a
-- lobby_member_id, the client hands its stored member id to join_lobby, and
-- start_next_lobby_session seeds everyone -- which is what the epic's own locked
-- default says should happen ("Guests may train in each session but cannot hold
-- command"). Host eligibility is unchanged: _lobby_pick_successor and
-- pass_lobby_command still require a user_id.

ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS lobby_member_id uuid NULL
    REFERENCES public.lobby_members (id) ON DELETE SET NULL;

-- One seat per member per session, enforced rather than merely intended.
CREATE UNIQUE INDEX IF NOT EXISTS participants_session_lobby_member_uidx
  ON public.participants (session_id, lobby_member_id)
  WHERE lobby_member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_participants_lobby_member_id
  ON public.participants (lobby_member_id)
  WHERE lobby_member_id IS NOT NULL;

-- Deliberately not granted to anon/authenticated: participants already withholds
-- user_id from the realtime SELECT grant, and this is the same class of data.

-- ---------------------------------------------------------------------------
-- create_lobby_session -- stamp the host's seat with its member id
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_lobby_session(
  p_duration_minutes int,
  p_nickname text,
  p_workout jsonb,
  p_template_id text,
  p_intensity_tier int,
  p_scheduled_at timestamptz,
  p_timezone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_lobby_id uuid;
  v_session_id uuid;
  v_host_token text;
  v_participant_id uuid;
  v_member_id uuid;
  v_nickname text;
  v_claim_token text;
  v_claim_hash text;
  v_template_id text;
  v_intensity_tier int;
  v_timezone text;
  v_today date;
  v_rally_date date;
  v_active int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.athlete_profiles WHERE user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Intake required';
  END IF;

  v_nickname := trim(p_nickname);
  IF v_nickname IS NULL OR v_nickname = '' OR length(v_nickname) > 50 THEN
    RAISE EXCEPTION 'Name or nickname is required (max 50 characters)';
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

  IF p_scheduled_at IS NOT NULL THEN
    v_timezone := btrim(p_timezone);
    IF v_timezone IS NULL
       OR v_timezone = ''
       OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_timezone)
    THEN
      RAISE EXCEPTION 'invalid_timezone';
    END IF;

    IF p_scheduled_at <= now() THEN
      RAISE EXCEPTION 'Rally time must be in the future';
    END IF;

    v_today := (now() AT TIME ZONE v_timezone)::date;
    v_rally_date := (p_scheduled_at AT TIME ZONE v_timezone)::date;

    IF v_rally_date < v_today OR v_rally_date > (v_today + 1) THEN
      RAISE EXCEPTION 'Rally time must be today or tomorrow';
    END IF;
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

  INSERT INTO public.lobbies (host_user_id, status)
  VALUES (v_uid, 'open')
  RETURNING id INTO v_lobby_id;

  INSERT INTO public.lobby_members (lobby_id, user_id, nickname, status, last_seen_at)
  VALUES (v_lobby_id, v_uid, v_nickname, 'active', now())
  RETURNING id INTO v_member_id;

  v_host_token := gen_random_uuid()::text;
  v_claim_token :=
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

  INSERT INTO public.sessions (
    host_token,
    duration_minutes,
    workout,
    template_id,
    intensity_tier,
    state,
    time_left_sec,
    scheduled_at,
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
    p_scheduled_at,
    v_lobby_id
  )
  RETURNING id INTO v_session_id;

  UPDATE public.lobbies
  SET active_session_id = v_session_id
  WHERE id = v_lobby_id;

  INSERT INTO public.participants
    (session_id, nickname, role, claim_token_hash, user_id, lobby_member_id)
  VALUES (v_session_id, v_nickname, 'host', v_claim_hash, v_uid, v_member_id)
  RETURNING id INTO v_participant_id;

  RETURN jsonb_build_object(
    'lobby_id', v_lobby_id,
    'lobby_member_id', v_member_id,
    'session_id', v_session_id,
    'host_token', v_host_token,
    'participant_id', v_participant_id,
    'claim_token', v_claim_token
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_lobby_session(int, text, jsonb, text, int, timestamptz, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_lobby_session(int, text, jsonb, text, int, timestamptz, text)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- join_lobby -- a guest reclaims its seat instead of minting another
--
-- Dropped and recreated rather than replaced: adding a defaulted third argument
-- would leave the two-argument version in place, and an overload pair is how
-- create_session ended up ambiguous (see README).
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.join_lobby(uuid, text);

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

        IF v_member_count >= 100 THEN
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

      IF v_member_count >= 100 THEN
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

          IF v_part_count >= 100 THEN
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

          IF v_part_count >= 100 THEN
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
-- start_next_lobby_session -- seed guests too, and link every seat
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
    ORDER BY joined_at ASC
  LOOP
    v_role := CASE
      WHEN v_member.user_id IS NOT NULL AND v_member.user_id = v_uid THEN 'host'
      ELSE 'joiner'
    END;

    v_claim_token :=
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

    INSERT INTO public.participants
      (session_id, nickname, role, claim_token_hash, user_id, lobby_member_id)
    VALUES (v_session_id, v_member.nickname, v_role, v_claim_hash, v_member.user_id, v_member.id);

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
