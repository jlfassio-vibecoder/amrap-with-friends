-- Persistent Staging Area (daisy-chaining missions).
--
-- Decouples the shared room (lobbies) from each workout instance (sessions).
-- Host command lives on lobbies.host_user_id; each new session still mints its
-- own host_token. Pass Command / stale claim rotate that token in one txn.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.lobbies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- FK to sessions added after sessions.lobby_id exists (circular refs).
  active_session_id uuid NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lobby_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id uuid NOT NULL REFERENCES public.lobbies (id) ON DELETE CASCADE,
  user_id uuid NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  nickname text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'left')),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lobby_members_nickname_len CHECK (
    char_length(btrim(nickname)) BETWEEN 1 AND 50
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS lobby_members_active_user_uidx
  ON public.lobby_members (lobby_id, user_id)
  WHERE user_id IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_lobby_members_lobby_id
  ON public.lobby_members (lobby_id);

CREATE INDEX IF NOT EXISTS idx_lobby_members_lobby_active
  ON public.lobby_members (lobby_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_lobbies_host_user_id
  ON public.lobbies (host_user_id);

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS lobby_id uuid REFERENCES public.lobbies (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_lobby_id
  ON public.sessions (lobby_id)
  WHERE lobby_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lobbies_active_session_id_fkey'
  ) THEN
    ALTER TABLE public.lobbies
      ADD CONSTRAINT lobbies_active_session_id_fkey
      FOREIGN KEY (active_session_id)
      REFERENCES public.sessions (id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

ALTER TABLE public.lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lobby_members ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.lobbies FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.lobby_members FROM PUBLIC, anon, authenticated;

-- Realtime SELECT (mutations stay RPC-only). Never expose secrets here.
GRANT SELECT (
  id,
  host_user_id,
  active_session_id,
  status,
  created_at,
  updated_at
) ON public.lobbies TO anon, authenticated;

GRANT SELECT (
  id,
  lobby_id,
  user_id,
  nickname,
  status,
  last_seen_at,
  joined_at
) ON public.lobby_members TO anon, authenticated;

GRANT SELECT (lobby_id) ON public.sessions TO anon, authenticated;

CREATE POLICY lobbies_select_realtime
  ON public.lobbies FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY lobby_members_select_realtime
  ON public.lobby_members FOR SELECT TO anon, authenticated
  USING (true);

ALTER TABLE public.lobbies REPLICA IDENTITY FULL;
ALTER TABLE public.lobby_members REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lobbies;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lobby_members;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._lobby_bump_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lobbies_bump_updated_at ON public.lobbies;
CREATE TRIGGER lobbies_bump_updated_at
  BEFORE UPDATE ON public.lobbies
  FOR EACH ROW
  EXECUTE FUNCTION public._lobby_bump_updated_at();

-- Rotate host_token + participant roles on a waiting/setup session.
-- Returns the new host_token (or NULL when there is no eligible session).
CREATE OR REPLACE FUNCTION public._lobby_rotate_waiting_host(
  p_session_id uuid,
  p_new_host_user_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_state text;
  v_new_token text;
  v_new_participant uuid;
BEGIN
  IF p_session_id IS NULL OR p_new_host_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT state INTO v_state
  FROM public.sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_state IS DISTINCT FROM 'waiting' AND v_state IS DISTINCT FROM 'setup' THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_new_participant
  FROM public.participants
  WHERE session_id = p_session_id
    AND user_id = p_new_host_user_id
  ORDER BY joined_at ASC
  LIMIT 1;

  IF v_new_participant IS NULL THEN
    RETURN NULL;
  END IF;

  v_new_token := gen_random_uuid()::text;

  UPDATE public.sessions
  SET host_token = v_new_token
  WHERE id = p_session_id;

  UPDATE public.participants
  SET role = 'joiner'
  WHERE session_id = p_session_id
    AND role = 'host'
    AND id IS DISTINCT FROM v_new_participant;

  UPDATE public.participants
  SET role = 'host'
  WHERE id = v_new_participant;

  RETURN v_new_token;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._lobby_rotate_waiting_host(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

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

REVOKE EXECUTE ON FUNCTION public._lobby_pick_successor(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- create_lobby_session
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

  INSERT INTO public.participants (session_id, nickname, role, claim_token_hash, user_id)
  VALUES (v_session_id, v_nickname, 'host', v_claim_hash, v_uid)
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

REVOKE EXECUTE ON FUNCTION public.join_lobby(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_lobby(uuid, text) TO anon, authenticated;

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
-- start_next_lobby_session
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

-- ---------------------------------------------------------------------------
-- leave_lobby
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
-- close_lobby
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
-- get_lobby (read snapshot for clients)
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

REVOKE EXECUTE ON FUNCTION public.get_lobby(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_lobby(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Presence heartbeat + stale host claim (Phase 5)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.touch_lobby_presence(p_lobby_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_updated int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.lobby_members
  SET last_seen_at = now()
  WHERE lobby_id = p_lobby_id
    AND user_id = v_uid
    AND status = 'active';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object('ok', v_updated > 0, 'lobby_id', p_lobby_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.touch_lobby_presence(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_lobby_presence(uuid) TO authenticated;

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

REVOKE EXECUTE ON FUNCTION public.claim_lobby_command_if_stale(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_lobby_command_if_stale(uuid) TO authenticated;
