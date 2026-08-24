-- Phase 1: Base score — partial reps per participant segment + submit RPC

CREATE TABLE IF NOT EXISTS public.participant_segment_results (
  participant_id uuid NOT NULL REFERENCES public.participants (id) ON DELETE CASCADE,
  segment_index int NOT NULL,
  partial_reps int NOT NULL DEFAULT 0 CHECK (partial_reps >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (participant_id, segment_index)
);

CREATE INDEX IF NOT EXISTS idx_participant_segment_results_participant_id
  ON public.participant_segment_results (participant_id);

GRANT SELECT (
  participant_id,
  segment_index,
  partial_reps,
  created_at,
  updated_at
) ON public.participant_segment_results TO anon, authenticated;

ALTER TABLE public.participant_segment_results REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.participant_segment_results;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE POLICY participant_segment_results_select_anon
  ON public.participant_segment_results
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.compute_reps_per_round(p_workout jsonb)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_len int;
  v_elem jsonb;
  v_target int;
  v_unit text;
  v_total int := 0;
  i int;
BEGIN
  IF p_workout IS NULL OR jsonb_typeof(p_workout) <> 'array' THEN
    RAISE EXCEPTION 'Invalid workout';
  END IF;

  v_len := jsonb_array_length(p_workout);
  IF v_len < 1 THEN
    RAISE EXCEPTION 'Invalid workout';
  END IF;

  FOR i IN 0..(v_len - 1) LOOP
    v_elem := p_workout -> i;
    IF jsonb_typeof(v_elem) <> 'object' THEN
      RAISE EXCEPTION 'Invalid workout';
    END IF;

    IF NOT (v_elem ? 'target') OR jsonb_typeof(v_elem -> 'target') <> 'number' THEN
      RAISE EXCEPTION 'Invalid workout movement target';
    END IF;

    v_target := (v_elem ->> 'target')::int;
    IF v_target IS NULL OR v_target <= 0 THEN
      RAISE EXCEPTION 'Invalid workout movement target';
    END IF;

    v_unit := lower(coalesce(v_elem ->> 'unit', 'reps'));
    IF v_unit NOT IN ('reps', 'sec') THEN
      RAISE EXCEPTION 'Unsupported workout movement unit';
    END IF;

    v_total := v_total + v_target;
  END LOOP;

  RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_participant_result(
  p_session_id uuid,
  p_participant_id uuid,
  p_claim_token text,
  p_partial_reps int,
  p_segment_index int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_claim_token_hash text;
  v_participant_session_id uuid;
  v_participant_user_id uuid;
  v_authorized boolean := false;
  v_hash text;
  v_session_state text;
  v_session_segment_index int;
  v_workout jsonb;
  v_reps_per_round int;
BEGIN
  v_uid := auth.uid();

  IF p_session_id IS NULL OR p_participant_id IS NULL THEN
    RAISE EXCEPTION 'Participant not found';
  END IF;

  IF p_partial_reps IS NULL OR p_partial_reps < 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_partial_reps');
  END IF;

  IF p_segment_index IS NULL OR p_segment_index < 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_segment_index');
  END IF;

  SELECT claim_token_hash, session_id, user_id
  INTO v_claim_token_hash, v_participant_session_id, v_participant_user_id
  FROM public.participants
  WHERE id = p_participant_id;

  IF NOT FOUND OR v_participant_session_id <> p_session_id THEN
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

  SELECT state, segment_index, workout
  INTO v_session_state, v_session_segment_index, v_workout
  FROM public.sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF v_session_state NOT IN ('work', 'finished') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session_not_submittable');
  END IF;

  IF p_segment_index <> v_session_segment_index THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'stale_segment_index');
  END IF;

  BEGIN
    v_reps_per_round := public.compute_reps_per_round(v_workout);
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_workout');
  END;

  IF p_partial_reps >= v_reps_per_round THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'partial_reps_too_high');
  END IF;

  INSERT INTO public.participant_segment_results (
    participant_id,
    segment_index,
    partial_reps,
    updated_at
  )
  VALUES (
    p_participant_id,
    p_segment_index,
    p_partial_reps,
    now()
  )
  ON CONFLICT (participant_id, segment_index)
  DO UPDATE SET
    partial_reps = EXCLUDED.partial_reps,
    updated_at = now();

  RETURN jsonb_build_object(
    'ok', true,
    'participant_id', p_participant_id,
    'segment_index', p_segment_index,
    'partial_reps', p_partial_reps,
    'reps_per_round', v_reps_per_round
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_participant_result(uuid, uuid, text, int, int)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.my_sessions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_sessions jsonb;
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
        'session_id', s.id,
        'created_at', s.created_at,
        'duration_minutes', s.duration_minutes,
        'workout', s.workout,
        'state', s.state,
        'segment_index', s.segment_index,
        'round_count', (
          SELECT count(*)::int
          FROM public.rounds r
          WHERE r.participant_id = p.id AND r.segment_index = s.segment_index
        ),
        'partial_reps', coalesce(
          (
            SELECT psr.partial_reps
            FROM public.participant_segment_results psr
            WHERE psr.participant_id = p.id
              AND psr.segment_index = s.segment_index
          ),
          0
        )
      )
      ORDER BY p.joined_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_sessions
  FROM public.participants p
  INNER JOIN public.sessions s ON s.id = p.session_id
  WHERE p.user_id = v_uid;

  RETURN jsonb_build_object('ok', true, 'sessions', v_sessions);
END;
$$;
