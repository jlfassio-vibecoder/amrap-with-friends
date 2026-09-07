-- Carry movement_variants on the two read paths that already carry
-- modified_movements, so the named scaling reaches the badge everywhere the
-- plain mark does.
--
-- Both function bodies are otherwise unchanged from the migrations named in
-- their own headers.

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

CREATE OR REPLACE FUNCTION public.my_missions()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_missions jsonb;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'participant_id', p.id,
        'nickname', p.nickname,
        'joined_at', p.joined_at,
        'role', p.role,
        'mission_id', s.id,
        'created_at', s.created_at,
        'scheduled_at', s.scheduled_at,
        'is_featured', coalesce(s.is_featured, false),
        'duration_minutes', s.duration_minutes,
        'workout', s.workout,
        'template_id', s.template_id,
        'rally_point_id', s.rally_point_id,
        'chain_item_count', (
          SELECT count(*)::int
          FROM public.mission_chain_items c
          WHERE c.rally_point_id = s.rally_point_id
        ),
        'chain_unstarted_count', (
          SELECT count(*)::int
          FROM public.mission_chain_items c
          WHERE c.rally_point_id = s.rally_point_id
            AND c.started_mission_id IS NULL
        ),
        'state', s.state,
        'segment_index', s.segment_index,
        'round_count', (
          SELECT count(*)::int
          FROM public.rounds r
          WHERE r.participant_id = p.id AND r.segment_index = s.segment_index
        ),
        'partial_reps', coalesce(psr.partial_reps, 0),
        'final_score', psr.final_score,
        'score_breakdown', psr.score_breakdown,
        'modified_movements', psr.modified_movements,
        'movement_variants', psr.movement_variants,
        'coach_workout_name', cw.name
      )
      ORDER BY coalesce(s.scheduled_at, s.created_at) DESC
    ),
    '[]'::jsonb
  )
  INTO v_missions
  FROM public.participants p
  INNER JOIN public.missions s ON s.id = p.mission_id
  LEFT JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
    AND psr.segment_index = s.segment_index
  LEFT JOIN public.coach_workouts cw
    ON s.template_id = 'coach:' || cw.id::text
  WHERE p.user_id = v_uid
    -- Early-cancelled featured slots (finished with no score) stay out of
    -- the list; delete is one occurrence only and should not linger as a row.
    AND NOT (
      coalesce(s.is_featured, false)
      AND s.state = 'finished'
      AND psr.score_breakdown IS NULL
    );

  RETURN jsonb_build_object('ok', true, 'missions', v_missions);
END;
$function$;
