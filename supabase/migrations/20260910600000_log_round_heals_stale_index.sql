-- Heal a stale round index instead of refusing it.
--
-- Observed on a live mission: the client held five rounds, the database held
-- six, and every subsequent press was rejected with round_index_mismatch while
-- the UI reported "Realtime: connected". Six rounds logged, twelve presses
-- lost, and no way out -- a refusal writes no row, so nothing ever arrived to
-- correct the client's view.
--
-- Fixed in the function rather than the client so it also repairs sessions
-- already running against the old build.

CREATE OR REPLACE FUNCTION public.log_round(
  p_mission_id uuid,
  p_participant_id uuid,
  p_claim_token text,
  p_round_index integer,
  p_elapsed_sec_at_round integer,
  p_segment_index integer,
  p_missed_log_reps integer DEFAULT NULL
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
  v_mission_state text;
  v_mission_segment_index int;
  v_duration_minutes int;
  v_max_work_sec int;
  v_round_count int;
  v_previous_elapsed int;
  v_last_elapsed int;
  v_index int;
  v_round_id uuid;
  v_hash text;
  v_uid uuid;
  v_authorized boolean := false;
BEGIN
  v_uid := auth.uid();

  IF p_mission_id IS NULL OR p_participant_id IS NULL THEN
    RAISE EXCEPTION 'Invalid round log';
  END IF;

  IF p_round_index < 0 OR p_elapsed_sec_at_round < 0 OR p_segment_index < 0 THEN
    RAISE EXCEPTION 'Invalid round log';
  END IF;

  SELECT claim_token_hash, mission_id, user_id
  INTO v_claim_token_hash, v_participant_mission_id, v_participant_user_id
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

  SELECT state, segment_index, duration_minutes
  INTO v_mission_state, v_mission_segment_index, v_duration_minutes
  FROM public.missions
  WHERE id = p_mission_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission not found';
  END IF;

  v_max_work_sec := v_duration_minutes * 60;

  IF p_elapsed_sec_at_round > v_max_work_sec THEN
    RAISE EXCEPTION 'Invalid round log';
  END IF;

  IF v_mission_state <> 'work' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'mission_not_in_work');
  END IF;

  IF p_segment_index <> v_mission_segment_index THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'stale_segment_index');
  END IF;

  SELECT count(*) INTO v_round_count
  FROM public.rounds
  WHERE participant_id = p_participant_id AND segment_index = p_segment_index;

  -- A client's round index comes from its own realtime view of its rounds. Lose
  -- one INSERT -- a socket blip, a phone locked mid-workout -- and that view is
  -- permanently short, so every later round arrives with a stale index. This
  -- used to refuse them all, and because a refusal writes nothing, the client
  -- never received the row that would have corrected it: one dropped event
  -- ended round logging for the rest of the mission.
  --
  -- So a stale index is healed rather than refused. The athlete pressed the
  -- button; the round is real. What must still be refused is the same press
  -- arriving twice, and that is not distinguishable by index -- a double tap
  -- and a stale client send exactly the same one. It is distinguishable by the
  -- clock: a second press lands on the same mission second as the round just
  -- written, and no couplet in the library is finished inside a second.
  v_index := p_round_index;

  IF p_round_index <> v_round_count THEN
    SELECT elapsed_sec_at_round
    INTO v_last_elapsed
    FROM public.rounds
    WHERE participant_id = p_participant_id AND segment_index = p_segment_index
    ORDER BY round_index DESC
    LIMIT 1;

    IF v_last_elapsed IS NOT NULL
      AND abs(v_last_elapsed - p_elapsed_sec_at_round) <= 1 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_round');
    END IF;

    v_index := v_round_count;
  END IF;

  IF p_missed_log_reps IS NOT NULL THEN
    IF p_missed_log_reps < 0 THEN
      RAISE EXCEPTION 'Invalid round log';
    END IF;

    SELECT elapsed_sec_at_round
    INTO v_previous_elapsed
    FROM public.rounds
    WHERE participant_id = p_participant_id
      AND segment_index = p_segment_index
      AND round_index = v_index - 1;

    IF v_previous_elapsed IS NOT NULL AND p_elapsed_sec_at_round <= v_previous_elapsed THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'elapsed_before_previous_round');
    END IF;
  END IF;

  INSERT INTO public.rounds (
    mission_id,
    participant_id,
    round_index,
    elapsed_sec_at_round,
    segment_index,
    missed_log_reps
  )
  VALUES (
    p_mission_id,
    p_participant_id,
    v_index,
    p_elapsed_sec_at_round,
    p_segment_index,
    p_missed_log_reps
  )
  ON CONFLICT (participant_id, segment_index, round_index) DO NOTHING
  RETURNING id INTO v_round_id;

  IF v_round_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_round');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'round_id', v_round_id,
    'round_index', v_index,
    'elapsed_sec_at_round', p_elapsed_sec_at_round,
    'segment_index', p_segment_index,
    'missed_log_reps', p_missed_log_reps
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.log_round(uuid, uuid, text, integer, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_round(uuid, uuid, text, integer, integer, integer, integer) TO anon, authenticated;
