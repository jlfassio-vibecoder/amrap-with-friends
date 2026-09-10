-- Audit RED fix: allow auth.uid() ownership even when claim_token_hash is still set.
-- Authenticated joiners keep both user_id and claim hash; reclaim returns no claim
-- token, so the old ELSIF nesting blocked live-state bootstrap on a new device.

CREATE OR REPLACE FUNCTION public.get_mission_live_state(
  p_mission_id uuid,
  p_participant_id uuid,
  p_claim_token text DEFAULT NULL,
  p_host_token text DEFAULT NULL
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
  v_rounds jsonb;
  v_messages jsonb;
  v_segment_results jsonb;
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

  -- Host → seat owner (auth.uid) → claim hash. Owner check is independent of claim hash.
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

  SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.joined_at ASC), '[]'::jsonb)
  INTO v_participants
  FROM (
    SELECT id, mission_id, nickname, role, joined_at
    FROM public.participants
    WHERE mission_id = p_mission_id
  ) p;

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
  ) psr;

  RETURN jsonb_build_object(
    'ok', true,
    'mission', v_mission,
    'participants', v_participants,
    'rounds', v_rounds,
    'messages', v_messages,
    'segment_results', v_segment_results
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_mission_live_state(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_mission_live_state(uuid, uuid, text, text) TO anon, authenticated;
