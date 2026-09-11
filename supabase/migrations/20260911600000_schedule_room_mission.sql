-- Scheduling a mission into a room.
--
-- Deliberately not a widening of create_mission. That function carries the
-- *athlete's* rules -- rally time must be today or tomorrow, at most three
-- active hosted missions, campaign make-up interception -- and none of them
-- describe a coach putting next Tuesday's session in front of their room.
-- Bolting a room branch through it would have made both policies harder to
-- read and one of them wrong.
--
-- What a room mission does share: the same missions row, the same host token,
-- the same host participant, so every existing path -- the rally point, the
-- live engine, scoring, share cards -- works on it untouched.

/** How far ahead a room may schedule. A season's worth is not a v1 problem. */
CREATE OR REPLACE FUNCTION public.room_schedule_horizon_days()
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, extensions
AS $$ SELECT 60 $$;

CREATE OR REPLACE FUNCTION public.schedule_room_mission(
  p_room_id uuid,
  p_nickname text,
  p_duration_minutes integer,
  p_workout jsonb,
  p_template_id text DEFAULT NULL,
  p_intensity_tier integer DEFAULT NULL,
  p_scheduled_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_timezone text;
  v_mission_id uuid;
  v_host_token text;
  v_participant_id uuid;
  v_claim_token text;
  v_claim_hash text;
  v_nickname text;
  v_template_id text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  -- Owner or co-host. A co-host running the room is exactly what the role is
  -- for; a member is not.
  IF coalesce(public.room_role(p_room_id, v_uid), '') NOT IN ('owner', 'cohost') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  -- A room whose entitlement has lapsed goes read-only: the page and its
  -- history stay, new missions stop. Checked here rather than in the UI,
  -- because the UI is not the boundary.
  IF NOT public.room_is_active(p_room_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'room_inactive');
  END IF;

  SELECT timezone INTO v_timezone FROM public.rooms WHERE id = p_room_id;

  v_nickname := btrim(coalesce(p_nickname, ''));
  IF v_nickname = '' OR length(v_nickname) > 50 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_nickname');
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes < 1 OR p_duration_minutes > 60 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_duration');
  END IF;

  IF NOT public.validate_workout(p_workout) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_workout');
  END IF;

  IF p_template_id IS NOT NULL THEN
    v_template_id := btrim(p_template_id);
    IF v_template_id = '' OR length(v_template_id) > 120 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_template');
    END IF;
  END IF;

  IF p_intensity_tier IS NOT NULL AND (p_intensity_tier < 1 OR p_intensity_tier > 5) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_intensity');
  END IF;

  -- A scheduled time is optional: "start one now" and "put one on Tuesday" are
  -- the same button with and without a date.
  IF p_scheduled_at IS NOT NULL THEN
    IF p_scheduled_at <= now() THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'scheduled_in_past');
    END IF;
    IF p_scheduled_at > now() + (public.room_schedule_horizon_days() || ' days')::interval THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'too_far_ahead');
    END IF;
  END IF;

  v_host_token := gen_random_uuid()::text;
  v_claim_token :=
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

  INSERT INTO public.missions (
    host_token,
    duration_minutes,
    workout,
    template_id,
    intensity_tier,
    state,
    time_left_sec,
    scheduled_at,
    room_id
  )
  VALUES (
    v_host_token,
    p_duration_minutes,
    p_workout,
    v_template_id,
    p_intensity_tier,
    'waiting',
    10,
    p_scheduled_at,
    p_room_id
  )
  RETURNING id INTO v_mission_id;

  INSERT INTO public.participants (mission_id, nickname, role, claim_token_hash, user_id)
  VALUES (v_mission_id, v_nickname, 'host', v_claim_hash, v_uid)
  RETURNING id INTO v_participant_id;

  RETURN jsonb_build_object(
    'ok', true,
    'mission_id', v_mission_id,
    'host_token', v_host_token,
    'participant_id', v_participant_id,
    'claim_token', v_claim_token,
    'timezone', v_timezone
  );
END;
$$;

-- The room's own missions: what is coming, and what to run again.
--
-- Readable by anyone, because the next mission is the main thing a room page
-- has to say. Host tokens and claim tokens are never in here.
CREATE OR REPLACE FUNCTION public.list_room_missions(p_room_id uuid, p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(row ORDER BY row ->> 'sort_at' DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'mission_id', m.id,
      'state', m.state,
      'duration_minutes', m.duration_minutes,
      'template_id', m.template_id,
      'workout', m.workout,
      'scheduled_at', m.scheduled_at,
      'created_at', m.created_at,
      'sort_at', coalesce(m.scheduled_at, m.created_at),
      'finishers', (
        SELECT count(*)
        FROM public.participants p
        JOIN public.participant_segment_results psr
          ON psr.participant_id = p.id AND psr.segment_index = m.segment_index
        WHERE p.mission_id = m.id AND psr.final_score IS NOT NULL
      )
    ) AS row
    FROM public.missions m
    WHERE m.room_id = p_room_id
    ORDER BY coalesce(m.scheduled_at, m.created_at) DESC
    LIMIT least(greatest(coalesce(p_limit, 20), 1), 50)
  ) rows;

  RETURN jsonb_build_object('ok', true, 'missions', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_room_mission(uuid, text, integer, jsonb, text, integer, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_room_mission(uuid, text, integer, jsonb, text, integer, timestamptz) TO authenticated;

REVOKE ALL ON FUNCTION public.list_room_missions(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_room_missions(uuid, int) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.room_schedule_horizon_days() FROM PUBLIC;
