-- Live-state scale cuts for guest polls:
-- 1. Incremental get_mission_live_state omits workout and returns participant_ids
--    plus only newly joined participants.
-- 2. send_message rate-limits to one message per participant per 2 seconds.

CREATE INDEX IF NOT EXISTS idx_messages_mission_participant_created
  ON public.messages (mission_id, participant_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.send_message(
  p_mission_id uuid,
  p_participant_id uuid,
  p_claim_token text,
  p_body text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_claim_token_hash text;
  v_participant_mission_id uuid;
  v_participant_user_id uuid;
  v_participant_nickname text;
  v_mission_segment_index int;
  v_body text;
  v_hash text;
  v_uid uuid;
  v_authorized boolean := false;
  v_message_id uuid;
  v_created_at timestamptz;
BEGIN
  v_uid := auth.uid();

  IF p_mission_id IS NULL OR p_participant_id IS NULL THEN
    RAISE EXCEPTION 'Invalid message';
  END IF;

  IF p_body IS NULL THEN
    RAISE EXCEPTION 'Invalid message';
  END IF;

  v_body := btrim(p_body, E' \t\n\r');

  IF v_body = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'empty_body');
  END IF;

  IF length(v_body) > 500 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'body_too_long');
  END IF;

  SELECT claim_token_hash, mission_id, user_id, nickname
  INTO v_claim_token_hash, v_participant_mission_id, v_participant_user_id, v_participant_nickname
  FROM public.participants
  WHERE id = p_participant_id;

  IF NOT FOUND OR v_participant_mission_id <> p_mission_id THEN
    RAISE EXCEPTION 'Participant not found';
  END IF;

  IF v_uid IS NOT NULL
    AND v_participant_user_id IS NOT NULL
    AND v_participant_user_id = v_uid THEN
    v_authorized := true;
  END IF;

  IF NOT v_authorized
    AND v_claim_token_hash IS NOT NULL
    AND p_claim_token IS NOT NULL THEN
    v_hash := encode(digest(p_claim_token, 'sha256'), 'hex');
    IF v_hash = v_claim_token_hash THEN
      v_authorized := true;
    END IF;
  END IF;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_claim_token');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.messages
    WHERE mission_id = p_mission_id
      AND participant_id = p_participant_id
      AND created_at > now() - interval '2 seconds'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited');
  END IF;

  SELECT segment_index
  INTO v_mission_segment_index
  FROM public.missions
  WHERE id = p_mission_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission not found';
  END IF;

  INSERT INTO public.messages (
    mission_id,
    participant_id,
    nickname,
    body,
    segment_index
  )
  VALUES (
    p_mission_id,
    p_participant_id,
    v_participant_nickname,
    v_body,
    v_mission_segment_index
  )
  RETURNING id, created_at INTO v_message_id, v_created_at;

  RETURN jsonb_build_object(
    'ok', true,
    'message_id', v_message_id,
    'mission_id', p_mission_id,
    'participant_id', p_participant_id,
    'nickname', v_participant_nickname,
    'body', v_body,
    'segment_index', v_mission_segment_index,
    'created_at', v_created_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_mission_live_state(
  p_mission_id uuid,
  p_participant_id uuid,
  p_claim_token text DEFAULT NULL,
  p_host_token text DEFAULT NULL,
  p_since timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_claim_token_hash text;
  v_participant_mission_id uuid;
  v_participant_user_id uuid;
  v_host_token text;
  v_hash text;
  v_authorized boolean := false;
  v_mission jsonb;
  v_participants jsonb;
  v_participant_ids jsonb;
  v_rounds jsonb;
  v_messages jsonb;
  v_segment_results jsonb;
  v_incremental boolean := p_since IS NOT NULL;
BEGIN
  v_uid := auth.uid();

  IF p_mission_id IS NULL OR p_participant_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_claim_token');
  END IF;

  SELECT claim_token_hash, mission_id, user_id
  INTO v_claim_token_hash, v_participant_mission_id, v_participant_user_id
  FROM public.participants
  WHERE id = p_participant_id;

  IF NOT FOUND OR v_participant_mission_id <> p_mission_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_claim_token');
  END IF;

  SELECT host_token
  INTO v_host_token
  FROM public.missions
  WHERE id = p_mission_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_claim_token');
  END IF;

  IF p_host_token IS NOT NULL AND p_host_token = v_host_token THEN
    v_authorized := true;
  END IF;

  IF NOT v_authorized
    AND v_uid IS NOT NULL
    AND v_participant_user_id IS NOT NULL
    AND v_participant_user_id = v_uid THEN
    v_authorized := true;
  END IF;

  IF NOT v_authorized
    AND v_claim_token_hash IS NOT NULL
    AND p_claim_token IS NOT NULL THEN
    v_hash := encode(digest(p_claim_token, 'sha256'), 'hex');
    IF v_hash = v_claim_token_hash THEN
      v_authorized := true;
    END IF;
  END IF;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_claim_token');
  END IF;

  IF v_incremental THEN
    SELECT to_jsonb(m)
    INTO v_mission
    FROM (
      SELECT
        id,
        duration_minutes,
        template_id,
        state,
        time_left_sec,
        is_paused,
        started_at,
        scheduled_at,
        rally_point_countdown_ends_at,
        segment_index,
        created_at,
        is_featured,
        rally_point_id
      FROM public.missions
      WHERE id = p_mission_id
    ) m;

    SELECT coalesce(jsonb_agg(p.id ORDER BY p.joined_at ASC), '[]'::jsonb)
    INTO v_participant_ids
    FROM public.participants p
    WHERE p.mission_id = p_mission_id;

    SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.joined_at ASC), '[]'::jsonb)
    INTO v_participants
    FROM (
      SELECT id, mission_id, nickname, role, joined_at
      FROM public.participants
      WHERE mission_id = p_mission_id
        AND joined_at > p_since
    ) p;
  ELSE
    SELECT to_jsonb(m)
    INTO v_mission
    FROM (
      SELECT
        id,
        duration_minutes,
        workout,
        template_id,
        state,
        time_left_sec,
        is_paused,
        started_at,
        scheduled_at,
        rally_point_countdown_ends_at,
        segment_index,
        created_at,
        is_featured,
        rally_point_id
      FROM public.missions
      WHERE id = p_mission_id
    ) m;

    v_participant_ids := NULL;

    SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.joined_at ASC), '[]'::jsonb)
    INTO v_participants
    FROM (
      SELECT id, mission_id, nickname, role, joined_at
      FROM public.participants
      WHERE mission_id = p_mission_id
    ) p;
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at ASC), '[]'::jsonb)
  INTO v_rounds
  FROM (
    SELECT
      id,
      mission_id,
      participant_id,
      round_index,
      elapsed_sec_at_round,
      segment_index,
      missed_log_reps,
      created_at
    FROM public.rounds
    WHERE mission_id = p_mission_id
      AND (p_since IS NULL OR created_at > p_since)
  ) r;

  SELECT coalesce(jsonb_agg(to_jsonb(msg) ORDER BY msg.created_at ASC), '[]'::jsonb)
  INTO v_messages
  FROM (
    SELECT
      id,
      mission_id,
      participant_id,
      nickname,
      body,
      segment_index,
      created_at
    FROM public.messages
    WHERE mission_id = p_mission_id
      AND (p_since IS NULL OR created_at > p_since)
    ORDER BY created_at DESC
    LIMIT 50
  ) msg;

  SELECT coalesce(jsonb_agg(to_jsonb(psr) ORDER BY psr.updated_at ASC), '[]'::jsonb)
  INTO v_segment_results
  FROM (
    SELECT
      mission_id,
      participant_id,
      segment_index,
      partial_reps,
      final_score,
      score_breakdown,
      updated_at
    FROM public.participant_segment_results
    WHERE mission_id = p_mission_id
      AND (p_since IS NULL OR updated_at > p_since)
  ) psr;

  RETURN jsonb_build_object(
    'ok', true,
    'incremental', v_incremental,
    'mission', v_mission,
    'participants', v_participants,
    'participant_ids', v_participant_ids,
    'rounds', v_rounds,
    'messages', v_messages,
    'segment_results', v_segment_results
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_message(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_message(uuid, uuid, text, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_mission_live_state(uuid, uuid, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_mission_live_state(uuid, uuid, text, text, timestamptz) TO anon, authenticated;
