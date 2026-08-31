-- A missed Log round is recoverable.
--
-- Forgetting the button is not a scoring event, but today it reads as one. A
-- late log inflates one split and deflates the next, and PVI is
-- (slowest - fastest) / average, so a single miss hits both ends of that ratio
-- at once --- enough to drop a mission from Elite Pacing (x1.15) to System
-- Failure (x0.85). That punishes the athlete for the intensity of the workout,
-- which is exactly backwards.
--
-- The fix records where the round actually ended rather than when it was
-- reported. The client reconstructs the boundary from the reps the athlete had
-- already done of the next round (computeMissedRoundElapsedSec) and passes the
-- rep count along, so the correction is visible in the data rather than
-- indistinguishable from an ordinary log.

ALTER TABLE public.rounds
  ADD COLUMN IF NOT EXISTS missed_log_reps int NULL;

-- NULL means logged in the moment. A number means reconstructed, and records
-- how far into the next round the athlete was when they noticed, so the
-- estimate can be audited or re-derived later.
ALTER TABLE public.rounds
  DROP CONSTRAINT IF EXISTS rounds_missed_log_reps_range;
ALTER TABLE public.rounds
  ADD CONSTRAINT rounds_missed_log_reps_range
  CHECK (missed_log_reps IS NULL OR missed_log_reps >= 0);

-- Realtime already publishes this table; a new column rides along, and anon
-- reads rounds through rounds_select_anon which is not column-filtered.

DROP FUNCTION IF EXISTS public.log_round(uuid, uuid, text, integer, integer, integer);

CREATE OR REPLACE FUNCTION public.log_round(p_mission_id uuid, p_participant_id uuid, p_claim_token text, p_round_index integer, p_elapsed_sec_at_round integer, p_segment_index integer, p_missed_log_reps integer DEFAULT NULL)
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
  v_round_id uuid;
  v_hash text;
  v_uid uuid;
  v_authorized boolean := false;
BEGIN
  v_uid := auth.uid();

  IF p_mission_id IS NULL OR p_participant_id IS NULL OR p_claim_token IS NULL THEN
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

  IF v_claim_token_hash IS NOT NULL THEN
    v_hash := encode(digest(p_claim_token, 'sha256'), 'hex');
    IF v_hash = v_claim_token_hash THEN
      v_authorized := true;
    END IF;
  ELSIF v_uid IS NOT NULL
    AND v_participant_user_id IS NOT NULL
    AND v_participant_user_id = v_uid THEN
    v_authorized := true;
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

  IF p_round_index <> v_round_count THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'round_index_mismatch');
  END IF;

  -- A missed-log correction back-dates the round, which is the one place a
  -- client can send an elapsed time that is not simply "now". Bound it by the
  -- round before it so the correction can only ever shrink an inflated split,
  -- never rewrite the ones already banked.
  IF p_missed_log_reps IS NOT NULL THEN
    IF p_missed_log_reps < 0 THEN
      RAISE EXCEPTION 'Invalid round log';
    END IF;

    SELECT elapsed_sec_at_round
    INTO v_previous_elapsed
    FROM public.rounds
    WHERE participant_id = p_participant_id
      AND segment_index = p_segment_index
      AND round_index = p_round_index - 1;

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
    p_round_index,
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
    'round_index', p_round_index,
    'elapsed_sec_at_round', p_elapsed_sec_at_round,
    'segment_index', p_segment_index,
    'missed_log_reps', p_missed_log_reps
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.log_round(uuid, uuid, text, integer, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_round(uuid, uuid, text, integer, integer, integer, integer) TO anon, authenticated;
