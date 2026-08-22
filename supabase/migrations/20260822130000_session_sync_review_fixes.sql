-- PR 4 review fixes: log_round elapsed_sec upper bound (already-deployed DBs)

CREATE OR REPLACE FUNCTION public.log_round(
  p_session_id uuid,
  p_participant_id uuid,
  p_claim_token text,
  p_round_index int,
  p_elapsed_sec_at_round int,
  p_segment_index int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_claim_token_hash text;
  v_participant_session_id uuid;
  v_session_state text;
  v_session_segment_index int;
  v_duration_minutes int;
  v_max_work_sec int;
  v_round_count int;
  v_round_id uuid;
  v_hash text;
BEGIN
  IF p_session_id IS NULL OR p_participant_id IS NULL OR p_claim_token IS NULL THEN
    RAISE EXCEPTION 'Invalid round log';
  END IF;

  IF p_round_index < 0 OR p_elapsed_sec_at_round < 0 OR p_segment_index < 0 THEN
    RAISE EXCEPTION 'Invalid round log';
  END IF;

  SELECT claim_token_hash, session_id
  INTO v_claim_token_hash, v_participant_session_id
  FROM public.participants
  WHERE id = p_participant_id;

  IF NOT FOUND OR v_participant_session_id <> p_session_id THEN
    RAISE EXCEPTION 'Participant not found';
  END IF;

  v_hash := encode(digest(p_claim_token, 'sha256'), 'hex');

  IF v_claim_token_hash IS NULL OR v_hash <> v_claim_token_hash THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_claim_token');
  END IF;

  SELECT state, segment_index, duration_minutes
  INTO v_session_state, v_session_segment_index, v_duration_minutes
  FROM public.sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  v_max_work_sec := v_duration_minutes * 60;

  IF p_elapsed_sec_at_round > v_max_work_sec THEN
    RAISE EXCEPTION 'Invalid round log';
  END IF;

  IF v_session_state <> 'work' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session_not_in_work');
  END IF;

  IF p_segment_index <> v_session_segment_index THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'stale_segment_index');
  END IF;

  SELECT count(*) INTO v_round_count
  FROM public.rounds
  WHERE participant_id = p_participant_id AND segment_index = p_segment_index;

  IF p_round_index <> v_round_count THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'round_index_mismatch');
  END IF;

  INSERT INTO public.rounds (
    session_id,
    participant_id,
    round_index,
    elapsed_sec_at_round,
    segment_index
  )
  VALUES (
    p_session_id,
    p_participant_id,
    p_round_index,
    p_elapsed_sec_at_round,
    p_segment_index
  )
  ON CONFLICT (participant_id, segment_index, round_index) DO NOTHING
  RETURNING id INTO v_round_id;

  IF v_round_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_round');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'round_id', v_round_id,
    'round_index', p_round_index,
    'elapsed_sec_at_round', p_elapsed_sec_at_round,
    'segment_index', p_segment_index
  );
END;
$$;
