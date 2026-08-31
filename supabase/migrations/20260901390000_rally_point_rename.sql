-- Vocabulary: the lobby becomes the Rally Point, everywhere.
--
-- One name for one screen. "Lobby" lived in the data layer, "Staging area"
-- in the UI, and neither said what the screen is: the place the rally link
-- opens to, where the crew gathers and the mission is started. This migration
-- moves the data layer onto the UI's word so there is no translation step left
-- --- the exception CLAUDE.md used to carve out for lobby/staging is retired
-- in the same commit.
--
-- Renames only. Every table, column, constraint, index, policy and function
-- keeps its shape and its grants; ALTER ... RENAME carries table and column
-- privileges (including the column-level SELECT grants Realtime relies on)
-- and publication membership across untouched. Functions must be dropped and
-- recreated rather than renamed, because a plpgsql body stores its table
-- references as text and would still name the old tables.
--
-- Safe to run once, in lockstep with the front end: between deploying this and
-- deploying the client that calls the new RPC names, the old names are gone.

-- 1. Tables and columns.
ALTER TABLE public.lobbies RENAME TO rally_points;
ALTER TABLE public.lobby_members RENAME TO rally_point_members;
ALTER TABLE public.rally_point_members RENAME COLUMN lobby_id TO rally_point_id;
ALTER TABLE public.sessions RENAME COLUMN lobby_id TO rally_point_id;
ALTER TABLE public.sessions
  RENAME COLUMN lobby_countdown_ends_at TO rally_point_countdown_ends_at;
ALTER TABLE public.participants
  RENAME COLUMN lobby_member_id TO rally_point_member_id;

-- 2. Constraints and indexes. Cosmetic, but a schema that still says lobby in
-- half its error messages is the confusion this commit is removing.
ALTER TABLE public.rally_points RENAME CONSTRAINT lobbies_pkey TO rally_points_pkey;
ALTER TABLE public.rally_points RENAME CONSTRAINT lobbies_status_check TO rally_points_status_check;
ALTER TABLE public.rally_points RENAME CONSTRAINT lobbies_host_user_id_fkey TO rally_points_host_user_id_fkey;
ALTER TABLE public.rally_points RENAME CONSTRAINT lobbies_active_session_id_fkey TO rally_points_active_session_id_fkey;
ALTER TABLE public.rally_point_members RENAME CONSTRAINT lobby_members_pkey TO rally_point_members_pkey;
ALTER TABLE public.rally_point_members RENAME CONSTRAINT lobby_members_status_check TO rally_point_members_status_check;
ALTER TABLE public.rally_point_members RENAME CONSTRAINT lobby_members_nickname_len TO rally_point_members_nickname_len;
ALTER TABLE public.rally_point_members RENAME CONSTRAINT lobby_members_lobby_id_fkey TO rally_point_members_rally_point_id_fkey;
ALTER TABLE public.rally_point_members RENAME CONSTRAINT lobby_members_user_id_fkey TO rally_point_members_user_id_fkey;
ALTER TABLE public.participants RENAME CONSTRAINT participants_lobby_member_id_fkey TO participants_rally_point_member_id_fkey;
ALTER TABLE public.sessions RENAME CONSTRAINT sessions_lobby_id_fkey TO sessions_rally_point_id_fkey;

ALTER INDEX public.idx_lobbies_host_user_id RENAME TO idx_rally_points_host_user_id;
ALTER INDEX public.idx_lobby_members_lobby_active RENAME TO idx_rally_point_members_active;
ALTER INDEX public.idx_lobby_members_lobby_id RENAME TO idx_rally_point_members_rally_point_id;
ALTER INDEX public.idx_participants_lobby_member_id RENAME TO idx_participants_rally_point_member_id;
ALTER INDEX public.idx_sessions_lobby_id RENAME TO idx_sessions_rally_point_id;
ALTER INDEX public.lobby_members_active_user_uidx RENAME TO rally_point_members_active_user_uidx;
ALTER INDEX public.participants_session_lobby_member_uidx RENAME TO participants_session_rally_point_member_uidx;

-- 3. Drop what depends on the old function names, then the functions.
-- The policies are recreated against is_rally_point_member below; the trigger
-- against _rally_point_bump_updated_at.
DROP POLICY IF EXISTS lobbies_select_realtime ON public.rally_points;
DROP POLICY IF EXISTS lobby_members_select_realtime ON public.rally_point_members;
DROP TRIGGER IF EXISTS lobbies_bump_updated_at ON public.rally_points;

DROP FUNCTION IF EXISTS public.announce_next_mission(p_lobby_id uuid);
DROP FUNCTION IF EXISTS public._lobby_bump_updated_at();
DROP FUNCTION IF EXISTS public._lobby_pick_successor(p_lobby_id uuid, p_exclude_user_id uuid);
DROP FUNCTION IF EXISTS public._lobby_rotate_waiting_host(p_session_id uuid, p_new_host_user_id uuid);
DROP FUNCTION IF EXISTS public.cancel_lobby_countdown(p_session_id uuid, p_host_token text);
DROP FUNCTION IF EXISTS public.claim_lobby_command_if_stale(p_lobby_id uuid);
DROP FUNCTION IF EXISTS public.close_lobby(p_lobby_id uuid);
DROP FUNCTION IF EXISTS public.create_lobby_session(p_duration_minutes integer, p_nickname text, p_workout jsonb, p_template_id text, p_intensity_tier integer, p_scheduled_at timestamp with time zone, p_timezone text);
DROP FUNCTION IF EXISTS public.get_lobby(p_lobby_id uuid);
DROP FUNCTION IF EXISTS public.is_lobby_member(p_lobby_id uuid);
DROP FUNCTION IF EXISTS public.join_lobby(p_lobby_id uuid, p_nickname text, p_lobby_member_id uuid, p_seat_claim text);
DROP FUNCTION IF EXISTS public.leave_lobby(p_lobby_id uuid, p_lobby_member_id uuid, p_seat_claim text);
DROP FUNCTION IF EXISTS public.pass_lobby_command(p_lobby_id uuid, p_to_user_id uuid);
DROP FUNCTION IF EXISTS public.set_lobby_countdown(p_session_id uuid, p_host_token text, p_seconds integer);
DROP FUNCTION IF EXISTS public.start_next_lobby_session(p_lobby_id uuid, p_duration_minutes integer, p_workout jsonb, p_template_id text, p_intensity_tier integer);
DROP FUNCTION IF EXISTS public.touch_lobby_presence(p_lobby_id uuid);

-- 4. The functions, bodies rewritten onto the new names.
-- announce_next_mission keeps its name but takes a renamed parameter, so it is
-- dropped above and recreated here. update_session_scheduled_at keeps both and
-- is replaced in place; it is here only because its body writes a renamed
-- column.

CREATE OR REPLACE FUNCTION public._rally_point_bump_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;


CREATE OR REPLACE FUNCTION public._rally_point_pick_successor(p_rally_point_id uuid, p_exclude_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_grace interval := interval '45 seconds';
BEGIN
  -- Prefer earliest joined active claimed member who is still fresh.
  SELECT m.user_id
  INTO v_uid
  FROM public.rally_point_members m
  WHERE m.rally_point_id = p_rally_point_id
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
  FROM public.rally_point_members m
  WHERE m.rally_point_id = p_rally_point_id
    AND m.status = 'active'
    AND m.user_id IS NOT NULL
    AND m.user_id IS DISTINCT FROM p_exclude_user_id
  ORDER BY m.joined_at ASC
  LIMIT 1;

  RETURN v_uid;
END;
$function$;


CREATE OR REPLACE FUNCTION public._rally_point_rotate_waiting_host(p_session_id uuid, p_new_host_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
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
$function$;


CREATE OR REPLACE FUNCTION public.announce_next_mission(p_rally_point_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_rally_point public.rally_points%ROWTYPE;
  v_pending_at timestamptz;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_rally_point_id IS NULL THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  SELECT * INTO v_rally_point
  FROM public.rally_points
  WHERE id = p_rally_point_id
  FOR UPDATE;

  IF NOT FOUND OR v_rally_point.status <> 'open' THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  IF v_rally_point.host_user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Only the host can start the next session';
  END IF;

  v_pending_at := now();

  UPDATE public.rally_points
  SET next_mission_pending_at = v_pending_at
  WHERE id = p_rally_point_id;

  RETURN jsonb_build_object(
    'ok', true,
    'rally_point_id', p_rally_point_id,
    'next_mission_pending_at', v_pending_at
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.cancel_rally_point_countdown(p_session_id uuid, p_host_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_host_token text;
  v_state text;
BEGIN
  IF p_session_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT host_token, state
  INTO v_host_token, v_state
  FROM public.sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF p_host_token IS NULL OR p_host_token <> v_host_token THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_host_token');
  END IF;

  IF v_state <> 'waiting' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session_not_waiting');
  END IF;

  UPDATE public.sessions
  SET rally_point_countdown_ends_at = NULL
  WHERE id = p_session_id AND host_token = p_host_token;

  RETURN jsonb_build_object('ok', true);
END;
$function$;


CREATE OR REPLACE FUNCTION public.claim_rally_point_command_if_stale(p_rally_point_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_rally_point public.rally_points%ROWTYPE;
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

  SELECT * INTO v_rally_point
  FROM public.rally_points
  WHERE id = p_rally_point_id
  FOR UPDATE;

  IF NOT FOUND OR v_rally_point.status <> 'open' THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.rally_point_members
    WHERE rally_point_id = p_rally_point_id
      AND user_id = v_uid
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not a rally point member';
  END IF;

  IF v_rally_point.host_user_id = v_uid THEN
    RETURN jsonb_build_object(
      'ok', true,
      'claimed', false,
      'host_user_id', v_uid,
      'reason', 'already_host'
    );
  END IF;

  SELECT last_seen_at, status
  INTO v_host_seen, v_host_status
  FROM public.rally_point_members
  WHERE rally_point_id = p_rally_point_id
    AND user_id = v_rally_point.host_user_id
  ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, joined_at DESC
  LIMIT 1;

  IF v_host_status IS DISTINCT FROM 'left'
     AND v_host_seen IS NOT NULL
     AND v_host_seen > (now() - v_grace)
  THEN
    RETURN jsonb_build_object(
      'ok', true,
      'claimed', false,
      'host_user_id', v_rally_point.host_user_id,
      'reason', 'host_present'
    );
  END IF;

  v_successor := public._rally_point_pick_successor(p_rally_point_id, v_rally_point.host_user_id);
  IF v_successor IS NULL THEN
    RAISE EXCEPTION 'No successor available';
  END IF;

  IF v_successor IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object(
      'ok', true,
      'claimed', false,
      'host_user_id', v_rally_point.host_user_id,
      'successor_user_id', v_successor,
      'reason', 'not_successor'
    );
  END IF;

  SELECT nickname INTO v_nickname
  FROM public.rally_point_members
  WHERE rally_point_id = p_rally_point_id
    AND user_id = v_uid
    AND status = 'active'
  LIMIT 1;

  IF v_nickname IS NULL THEN
    RAISE EXCEPTION 'Not a rally point member';
  END IF;

  v_host_token := NULL;

  IF v_rally_point.active_session_id IS NOT NULL THEN
    SELECT state INTO v_session_state
    FROM public.sessions
    WHERE id = v_rally_point.active_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
      v_session_state := NULL;
    ELSIF v_session_state = 'work' THEN
      RAISE EXCEPTION 'Cannot claim command during a live session';
    ELSIF v_session_state IN ('waiting', 'setup') THEN
      SELECT id INTO v_participant_id
      FROM public.participants
      WHERE session_id = v_rally_point.active_session_id
        AND user_id = v_uid
      ORDER BY joined_at ASC
      LIMIT 1;

      IF v_participant_id IS NULL THEN
        v_claim_token :=
          replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
        v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

        INSERT INTO public.participants (session_id, nickname, role, claim_token_hash, user_id)
        VALUES (
          v_rally_point.active_session_id,
          v_nickname,
          'joiner',
          v_claim_hash,
          v_uid
        );
      END IF;

      UPDATE public.rally_points
      SET host_user_id = v_uid
      WHERE id = p_rally_point_id;

      v_rotated := public._rally_point_rotate_waiting_host(v_rally_point.active_session_id, v_uid);
      IF v_rotated IS NULL THEN
        RAISE EXCEPTION 'Cannot claim command during a live session';
      END IF;
      v_host_token := v_rotated;
    ELSIF v_session_state = 'finished' THEN
      UPDATE public.rally_points
      SET host_user_id = v_uid
      WHERE id = p_rally_point_id;
    ELSE
      RAISE EXCEPTION 'Cannot claim command during a live session';
    END IF;
  ELSE
    UPDATE public.rally_points
    SET host_user_id = v_uid
    WHERE id = p_rally_point_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'claimed', true,
    'rally_point_id', p_rally_point_id,
    'host_user_id', v_uid,
    'active_session_id', v_rally_point.active_session_id,
    'host_token', v_host_token
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.close_rally_point(p_rally_point_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_rally_point public.rally_points%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_rally_point
  FROM public.rally_points
  WHERE id = p_rally_point_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  IF v_rally_point.host_user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Only the host can close the staging area';
  END IF;

  UPDATE public.sessions
  SET state = 'finished', is_paused = false, time_left_sec = 0
  WHERE rally_point_id = p_rally_point_id
    AND state IN ('waiting', 'setup');

  UPDATE public.rally_points
  SET status = 'closed',
      active_session_id = NULL,
      next_mission_pending_at = NULL
  WHERE id = p_rally_point_id;

  UPDATE public.rally_point_members
  SET status = 'left'
  WHERE rally_point_id = p_rally_point_id
    AND status = 'active';

  RETURN jsonb_build_object('ok', true, 'rally_point_id', p_rally_point_id, 'status', 'closed');
END;
$function$;


CREATE OR REPLACE FUNCTION public.create_rally_point_session(p_duration_minutes integer, p_nickname text, p_workout jsonb, p_template_id text, p_intensity_tier integer, p_scheduled_at timestamp with time zone, p_timezone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_rally_point_id uuid;
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

  INSERT INTO public.rally_points (host_user_id, status)
  VALUES (v_uid, 'open')
  RETURNING id INTO v_rally_point_id;

  INSERT INTO public.rally_point_members (rally_point_id, user_id, nickname, status, last_seen_at)
  VALUES (v_rally_point_id, v_uid, v_nickname, 'active', now())
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
    rally_point_id
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
    v_rally_point_id
  )
  RETURNING id INTO v_session_id;

  UPDATE public.rally_points
  SET active_session_id = v_session_id
  WHERE id = v_rally_point_id;

  INSERT INTO public.participants
    (session_id, nickname, role, claim_token_hash, user_id, rally_point_member_id)
  VALUES (v_session_id, v_nickname, 'host', v_claim_hash, v_uid, v_member_id)
  RETURNING id INTO v_participant_id;

  RETURN jsonb_build_object(
    'rally_point_id', v_rally_point_id,
    'rally_point_member_id', v_member_id,
    'session_id', v_session_id,
    'host_token', v_host_token,
    'participant_id', v_participant_id,
    'claim_token', v_claim_token
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_rally_point(p_rally_point_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_rally_point public.rally_points%ROWTYPE;
  v_members jsonb;
  v_active_session_state text;
  v_uid uuid;
  v_is_anon boolean;
BEGIN
  v_uid := auth.uid();
  v_is_anon := v_uid IS NULL;

  IF p_rally_point_id IS NULL THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  SELECT * INTO v_rally_point FROM public.rally_points WHERE id = p_rally_point_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  v_active_session_state := NULL;
  IF v_rally_point.active_session_id IS NOT NULL THEN
    SELECT state INTO v_active_session_state
    FROM public.sessions
    WHERE id = v_rally_point.active_session_id;
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
  FROM public.rally_point_members m
  WHERE m.rally_point_id = p_rally_point_id
    AND m.status = 'active';

  RETURN jsonb_build_object(
    'ok', true,
    'rally_point_id', v_rally_point.id,
    'host_user_id', CASE WHEN v_is_anon THEN NULL ELSE v_rally_point.host_user_id END,
    'active_session_id', v_rally_point.active_session_id,
    'active_session_state', v_active_session_state,
    'status', v_rally_point.status,
    'created_at', v_rally_point.created_at,
    'updated_at', v_rally_point.updated_at,
    'next_mission_pending_at', v_rally_point.next_mission_pending_at,
    'members', v_members
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.is_rally_point_member(p_rally_point_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.rally_points l
    WHERE l.id = p_rally_point_id
      AND l.host_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.rally_point_members m
    WHERE m.rally_point_id = p_rally_point_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
  )
$function$;


CREATE OR REPLACE FUNCTION public.join_rally_point(p_rally_point_id uuid, p_nickname text, p_rally_point_member_id uuid DEFAULT NULL::uuid, p_seat_claim text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_rally_point public.rally_points%ROWTYPE;
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

  IF p_rally_point_id IS NULL THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  SELECT * INTO v_rally_point
  FROM public.rally_points
  WHERE id = p_rally_point_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  IF v_rally_point.status <> 'open' THEN
    RAISE EXCEPTION 'Rally point closed';
  END IF;

  v_seat_claim := NULL;

  -- Reclaim active membership for authenticated users.
  IF v_uid IS NOT NULL THEN
    SELECT id, nickname
    INTO v_member_id, v_existing_nickname
    FROM public.rally_point_members
    WHERE rally_point_id = p_rally_point_id
      AND user_id = v_uid
      AND status = 'active'
    ORDER BY joined_at ASC
    LIMIT 1;

    IF FOUND THEN
      -- Keep the roster nickname on reclaim; return that same value to the client.
      v_nickname := coalesce(nullif(v_existing_nickname, ''), v_nickname);
      UPDATE public.rally_point_members
      SET last_seen_at = now(), nickname = v_nickname
      WHERE id = v_member_id;
    ELSE
      -- Reactivate a prior left row when present.
      SELECT id INTO v_member_id
      FROM public.rally_point_members
      WHERE rally_point_id = p_rally_point_id
        AND user_id = v_uid
        AND status = 'left'
      ORDER BY joined_at DESC
      LIMIT 1;

      IF FOUND THEN
        UPDATE public.rally_point_members
        SET status = 'active',
            nickname = v_nickname,
            last_seen_at = now(),
            joined_at = now()
        WHERE id = v_member_id;
      ELSE
        SELECT count(*)::int INTO v_member_count
        FROM public.rally_point_members
        WHERE rally_point_id = p_rally_point_id AND status = 'active';

        IF v_member_count >= public.session_participant_limit() THEN
          RAISE EXCEPTION 'Rally point is full';
        END IF;

        INSERT INTO public.rally_point_members (rally_point_id, user_id, nickname, status, last_seen_at)
        VALUES (p_rally_point_id, v_uid, v_nickname, 'active', now())
        RETURNING id INTO v_member_id;
      END IF;
    END IF;
  ELSE
    -- Guest seat ownership is a secret (seat_claim), not the public member id.
    -- Member ids appear in get_rally_point / Realtime for the roster; the claim does not.
    v_seat_claim := NULL;
    IF p_rally_point_member_id IS NOT NULL AND p_seat_claim IS NOT NULL AND length(trim(p_seat_claim)) > 0 THEN
      v_seat_hash := encode(digest(trim(p_seat_claim), 'sha256'), 'hex');

      SELECT id, claim_token_hash
      INTO v_member_id, v_stored_hash
      FROM public.rally_point_members
      WHERE id = p_rally_point_member_id
        AND rally_point_id = p_rally_point_id
        AND user_id IS NULL
        AND status = 'active'
      FOR UPDATE;

      IF FOUND AND v_stored_hash IS NOT NULL AND v_stored_hash = v_seat_hash THEN
        v_seat_claim :=
          replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
        v_seat_hash := encode(digest(v_seat_claim, 'sha256'), 'hex');

        UPDATE public.rally_point_members
        SET last_seen_at = now(),
            claim_token_hash = v_seat_hash
        WHERE id = v_member_id;
      ELSE
        v_member_id := NULL;
      END IF;
    END IF;

    IF v_member_id IS NULL THEN
      SELECT count(*)::int INTO v_member_count
      FROM public.rally_point_members
      WHERE rally_point_id = p_rally_point_id AND status = 'active';

      IF v_member_count >= public.session_participant_limit() THEN
        RAISE EXCEPTION 'Rally point is full';
      END IF;

      v_seat_claim :=
        replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
      v_seat_hash := encode(digest(v_seat_claim, 'sha256'), 'hex');

      INSERT INTO public.rally_point_members
        (rally_point_id, user_id, nickname, status, last_seen_at, claim_token_hash)
      VALUES (p_rally_point_id, NULL, v_nickname, 'active', now(), v_seat_hash)
      RETURNING id INTO v_member_id;
    END IF;
  END IF;

  v_session_id := v_rally_point.active_session_id;
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
            (session_id, nickname, role, claim_token_hash, user_id, rally_point_member_id)
          VALUES (v_session_id, v_nickname, 'joiner', v_claim_hash, v_uid, v_member_id)
          RETURNING id INTO v_participant_id;

          v_role := 'joiner';
        END IF;
      ELSE
        -- start_next_rally_point_session now seeds guests, so look for the seat this
        -- member already holds before making another one.
        SELECT p.id, p.role
        INTO v_participant_id, v_role
        FROM public.participants p
        WHERE p.session_id = v_session_id
          AND p.rally_point_member_id = v_member_id
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
            (session_id, nickname, role, claim_token_hash, user_id, rally_point_member_id)
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
    'rally_point_id', p_rally_point_id,
    'rally_point_member_id', v_member_id,
    'host_user_id', v_rally_point.host_user_id,
    'status', v_rally_point.status,
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
$function$;


CREATE OR REPLACE FUNCTION public.leave_rally_point(p_rally_point_id uuid, p_rally_point_member_id uuid DEFAULT NULL::uuid, p_seat_claim text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_rally_point public.rally_points%ROWTYPE;
  v_successor uuid;
  v_was_host boolean := false;
  v_updated int;
  v_seat_hash text;
BEGIN
  v_uid := auth.uid();

  IF p_rally_point_id IS NULL THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  SELECT * INTO v_rally_point
  FROM public.rally_points
  WHERE id = p_rally_point_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  IF v_uid IS NULL THEN
    IF p_rally_point_member_id IS NULL
       OR p_seat_claim IS NULL
       OR length(trim(p_seat_claim)) = 0
    THEN
      RAISE EXCEPTION 'Rally point not found';
    END IF;

    v_seat_hash := encode(digest(trim(p_seat_claim), 'sha256'), 'hex');

    UPDATE public.rally_point_members
    SET status = 'left'
    WHERE id = p_rally_point_member_id
      AND rally_point_id = p_rally_point_id
      AND user_id IS NULL
      AND status = 'active'
      AND claim_token_hash IS NOT NULL
      AND claim_token_hash = v_seat_hash;

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    RETURN jsonb_build_object(
      'ok', true,
      'rally_point_id', p_rally_point_id,
      'left', v_updated > 0
    );
  END IF;

  UPDATE public.rally_point_members
  SET status = 'left'
  WHERE rally_point_id = p_rally_point_id
    AND user_id = v_uid
    AND status = 'active';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', true, 'rally_point_id', p_rally_point_id, 'left', false);
  END IF;

  IF v_rally_point.host_user_id = v_uid AND v_rally_point.status = 'open' THEN
    v_was_host := true;
    v_successor := public._rally_point_pick_successor(p_rally_point_id, v_uid);

    IF v_successor IS NULL THEN
      UPDATE public.sessions
      SET state = 'finished', is_paused = false, time_left_sec = 0
      WHERE rally_point_id = p_rally_point_id
        AND state IN ('waiting', 'setup');

      UPDATE public.rally_points
      SET status = 'closed',
          active_session_id = NULL
      WHERE id = p_rally_point_id;

      UPDATE public.rally_point_members
      SET status = 'left'
      WHERE rally_point_id = p_rally_point_id
        AND status = 'active';

      RETURN jsonb_build_object(
        'ok', true,
        'rally_point_id', p_rally_point_id,
        'left', true,
        'closed', true
      );
    END IF;

    UPDATE public.rally_points
    SET host_user_id = v_successor
    WHERE id = p_rally_point_id;

    PERFORM public._rally_point_rotate_waiting_host(v_rally_point.active_session_id, v_successor);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'rally_point_id', p_rally_point_id,
    'left', true,
    'was_host', v_was_host,
    'host_user_id', coalesce(v_successor, v_rally_point.host_user_id)
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.pass_rally_point_command(p_rally_point_id uuid, p_to_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_rally_point public.rally_points%ROWTYPE;
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

  IF p_rally_point_id IS NULL OR p_to_user_id IS NULL THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  SELECT * INTO v_rally_point
  FROM public.rally_points
  WHERE id = p_rally_point_id
  FOR UPDATE;

  IF NOT FOUND OR v_rally_point.status <> 'open' THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  IF v_rally_point.host_user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Only the host can pass command';
  END IF;

  -- Checked after authority, not before it: a demoted host passing to themselves
  -- was told "Cannot pass command to yourself" when the real answer is that they
  -- no longer hold command. Refused either way; the message was just wrong.
  IF p_to_user_id = v_uid THEN
    RAISE EXCEPTION 'Cannot pass command to yourself';
  END IF;

  SELECT nickname INTO v_target_nickname
  FROM public.rally_point_members
  WHERE rally_point_id = p_rally_point_id
    AND user_id = p_to_user_id
    AND status = 'active'
  LIMIT 1;

  IF v_target_nickname IS NULL THEN
    RAISE EXCEPTION 'Target is not an active crew member';
  END IF;

  IF v_rally_point.active_session_id IS NOT NULL THEN
    SELECT state INTO v_session_state
    FROM public.sessions
    WHERE id = v_rally_point.active_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
      v_session_state := NULL;
    ELSIF v_session_state = 'work' THEN
      RAISE EXCEPTION 'Cannot pass command during a live session';
    ELSIF v_session_state IN ('waiting', 'setup') THEN
      SELECT id INTO v_target_participant
      FROM public.participants
      WHERE session_id = v_rally_point.active_session_id
        AND user_id = p_to_user_id
      ORDER BY joined_at ASC
      LIMIT 1;

      IF v_target_participant IS NULL THEN
        v_claim_token :=
          replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
        v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

        INSERT INTO public.participants (session_id, nickname, role, claim_token_hash, user_id)
        VALUES (
          v_rally_point.active_session_id,
          v_target_nickname,
          'joiner',
          v_claim_hash,
          p_to_user_id
        );
      END IF;

      UPDATE public.rally_points
      SET host_user_id = p_to_user_id
      WHERE id = p_rally_point_id;

      v_rotated := public._rally_point_rotate_waiting_host(v_rally_point.active_session_id, p_to_user_id);
      IF v_rotated IS NULL THEN
        RAISE EXCEPTION 'Cannot pass command during a live session';
      END IF;
    ELSIF v_session_state = 'finished' THEN
      UPDATE public.rally_points
      SET host_user_id = p_to_user_id
      WHERE id = p_rally_point_id;
    ELSE
      RAISE EXCEPTION 'Cannot pass command during a live session';
    END IF;
  ELSE
    UPDATE public.rally_points
    SET host_user_id = p_to_user_id
    WHERE id = p_rally_point_id;
  END IF;

  -- Never return the rotated token to the outgoing host.
  RETURN jsonb_build_object(
    'ok', true,
    'rally_point_id', p_rally_point_id,
    'host_user_id', p_to_user_id,
    'active_session_id', v_rally_point.active_session_id,
    'host_token', NULL
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.set_rally_point_countdown(p_session_id uuid, p_host_token text, p_seconds integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_host_token text;
  v_state text;
  v_ends_at timestamptz;
BEGIN
  IF p_session_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT host_token, state
  INTO v_host_token, v_state
  FROM public.sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF p_host_token IS NULL OR p_host_token <> v_host_token THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_host_token');
  END IF;

  IF v_state <> 'waiting' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session_not_waiting');
  END IF;

  IF p_seconds IS NULL OR p_seconds <= 0 OR p_seconds > 600 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_seconds');
  END IF;

  v_ends_at := now() + (p_seconds * interval '1 second');

  UPDATE public.sessions
  SET rally_point_countdown_ends_at = v_ends_at
  WHERE id = p_session_id AND host_token = p_host_token;

  RETURN jsonb_build_object(
    'ok', true,
    'rally_point_countdown_ends_at', v_ends_at
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.start_next_rally_point_session(p_rally_point_id uuid, p_duration_minutes integer, p_workout jsonb, p_template_id text, p_intensity_tier integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_rally_point public.rally_points%ROWTYPE;
  v_prior_state text;
  v_session_id uuid;
  v_host_token text;
  v_participant_id uuid;
  v_host_claim_token text;
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

  IF p_rally_point_id IS NULL THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  SELECT * INTO v_rally_point
  FROM public.rally_points
  WHERE id = p_rally_point_id
  FOR UPDATE;

  IF NOT FOUND OR v_rally_point.status <> 'open' THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  IF v_rally_point.host_user_id IS DISTINCT FROM v_uid THEN
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

  IF v_rally_point.active_session_id IS NOT NULL THEN
    SELECT state INTO v_prior_state
    FROM public.sessions
    WHERE id = v_rally_point.active_session_id
    FOR UPDATE;

    IF FOUND AND v_prior_state IS DISTINCT FROM 'finished' THEN
      RAISE EXCEPTION 'Current session is still active';
    END IF;
  END IF;

  SELECT host_user_id INTO v_rally_point.host_user_id
  FROM public.rally_points
  WHERE id = p_rally_point_id;

  IF v_rally_point.host_user_id IS DISTINCT FROM v_uid THEN
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
      s.rally_point_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.rally_points l
        WHERE l.id = s.rally_point_id
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
    rally_point_id
  )
  VALUES (
    v_host_token,
    p_duration_minutes,
    p_workout,
    v_template_id,
    v_intensity_tier,
    'waiting',
    10,
    p_rally_point_id
  )
  RETURNING id INTO v_session_id;

  UPDATE public.rally_points
  SET active_session_id = v_session_id,
      next_mission_pending_at = NULL
  WHERE id = p_rally_point_id;

  v_participant_id := NULL;
  v_host_claim_token := NULL;
  FOR v_member IN
    SELECT *
    FROM public.rally_point_members
    WHERE rally_point_id = p_rally_point_id
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
      (session_id, nickname, role, claim_token_hash, user_id, rally_point_member_id)
    VALUES (v_session_id, v_member.nickname, v_role, v_claim_hash, v_member.user_id, v_member.id);

    IF v_role = 'host' THEN
      v_host_claim_token := v_claim_token;
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
    'rally_point_id', p_rally_point_id,
    'session_id', v_session_id,
    'host_token', v_host_token,
    'participant_id', v_participant_id,
    'claim_token', v_host_claim_token
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.touch_rally_point_presence(p_rally_point_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_updated int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.rally_point_members
  SET last_seen_at = now()
  WHERE rally_point_id = p_rally_point_id
    AND user_id = v_uid
    AND status = 'active';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object('ok', v_updated > 0, 'rally_point_id', p_rally_point_id);
END;
$function$;


CREATE OR REPLACE FUNCTION public.update_session_scheduled_at(p_session_id uuid, p_scheduled_at timestamp with time zone, p_timezone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_state text;
  v_existing_scheduled_at timestamptz;
  v_timezone text;
  v_today date;
  v_rally_date date;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'Session id is required';
  END IF;

  IF p_scheduled_at IS NULL THEN
    RAISE EXCEPTION 'Rally time is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.participants p
    WHERE p.session_id = p_session_id
      AND p.user_id = v_uid
      AND p.role = 'host'
  ) THEN
    RAISE EXCEPTION 'Only the host can update rally time';
  END IF;

  SELECT s.state, s.scheduled_at
  INTO v_state, v_existing_scheduled_at
  FROM public.sessions s
  WHERE s.id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF v_existing_scheduled_at IS NULL THEN
    RAISE EXCEPTION 'Session has no scheduled rally time';
  END IF;

  IF v_state <> 'waiting' THEN
    RAISE EXCEPTION 'Session is not waiting';
  END IF;

  v_timezone := btrim(p_timezone);
  IF v_timezone IS NULL
     OR v_timezone = ''
     OR NOT EXISTS (
       SELECT 1
       FROM pg_timezone_names
       WHERE name = v_timezone
     )
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

  UPDATE public.sessions
  SET scheduled_at = p_scheduled_at,
      rally_point_countdown_ends_at = NULL
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'ok', true,
    'scheduled_at', p_scheduled_at
  );
END;
$function$;

-- 5. Grants, matching what each function had before the rename.
REVOKE EXECUTE ON FUNCTION public.announce_next_mission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.announce_next_mission(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_rally_point_countdown(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_rally_point_countdown(uuid, text) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_rally_point_command_if_stale(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_rally_point_command_if_stale(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.close_rally_point(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_rally_point(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_rally_point_session(integer, text, jsonb, text, integer, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_rally_point_session(integer, text, jsonb, text, integer, timestamptz, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_rally_point(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_rally_point(uuid) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_rally_point_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_rally_point_member(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.join_rally_point(uuid, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_rally_point(uuid, text, uuid, text) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.leave_rally_point(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_rally_point(uuid, uuid, text) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pass_rally_point_command(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pass_rally_point_command(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_rally_point_countdown(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_rally_point_countdown(uuid, text, integer) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.start_next_rally_point_session(uuid, integer, jsonb, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_next_rally_point_session(uuid, integer, jsonb, text, integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_rally_point_presence(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_rally_point_presence(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_session_scheduled_at(uuid, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_session_scheduled_at(uuid, timestamptz, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public._rally_point_pick_successor(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._rally_point_rotate_waiting_host(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._rally_point_bump_updated_at() FROM PUBLIC, anon, authenticated;

-- 6. The trigger and the Realtime read policies, back on the new names.
CREATE TRIGGER rally_points_bump_updated_at
  BEFORE UPDATE ON public.rally_points
  FOR EACH ROW EXECUTE FUNCTION public._rally_point_bump_updated_at();

CREATE POLICY rally_points_select_realtime ON public.rally_points
  FOR SELECT TO authenticated
  USING (public.is_rally_point_member(id));

CREATE POLICY rally_point_members_select_realtime ON public.rally_point_members
  FOR SELECT TO authenticated
  USING (public.is_rally_point_member(rally_point_id));

