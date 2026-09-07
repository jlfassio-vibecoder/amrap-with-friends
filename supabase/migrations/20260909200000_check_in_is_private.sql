-- Check-ins are private to the athlete who wrote them.
--
-- 20260909180000 granted anon and authenticated column SELECT on rpe,
-- session_notes and check_ins, following the pattern the modified-movement
-- columns set. Those columns are a different class of data and the pattern did
-- not transfer.
--
-- participant_segment_results_select_member is
-- `USING (is_mission_participant(mission_id))`, so the grants let every signed-in
-- athlete in a mission read every other athlete's free-text notes, pain mark,
-- mood and sleep. get_mission_live_state is worse: it is SECURITY DEFINER and
-- returns every participant's segment result to anyone holding a claim or host
-- token, guests included.
--
-- modified_movements is public by design — it is printed on the leaderboard so
-- another athlete can read the score. Notes, pain, mood and sleep are not shown
-- to anyone but their author, anywhere in the product, and the client parsed
-- them out of the live payload without ever rendering them. The exposure bought
-- nothing.
--
-- my_missions keeps all three: it is scoped to `p.user_id = v_uid`, so it only
-- ever returns the caller their own rows. That is the one read path check-ins
-- belong on.

REVOKE SELECT (rpe) ON public.participant_segment_results FROM anon, authenticated;
REVOKE SELECT (session_notes) ON public.participant_segment_results FROM anon, authenticated;
REVOKE SELECT (check_ins) ON public.participant_segment_results FROM anon, authenticated;


-- get_mission_live_state, unchanged except that segment_results no longer
-- carries the three check-in columns.

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
  v_snapshot_at timestamptz := clock_timestamp();
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
        AND joined_at >= p_since
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
      modified_movements,
      movement_variants,
      updated_at
    FROM public.participant_segment_results
    WHERE mission_id = p_mission_id
      AND (p_since IS NULL OR updated_at > p_since)
  ) psr;

  RETURN jsonb_build_object(
    'ok', true,
    'incremental', v_incremental,
    'snapshot_at', v_snapshot_at,
    'mission', v_mission,
    'participants', v_participants,
    'participant_ids', v_participant_ids,
    'rounds', v_rounds,
    'messages', v_messages,
    'segment_results', v_segment_results
  );
END;
$$;
