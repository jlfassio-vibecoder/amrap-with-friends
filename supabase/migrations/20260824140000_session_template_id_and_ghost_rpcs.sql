-- Phase 7: template_id for ghost matching + ghost discovery/curve RPCs

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS template_id text NULL;

GRANT SELECT (template_id) ON public.sessions TO anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_sessions_template_duration
  ON public.sessions (template_id, duration_minutes)
  WHERE template_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_session(
  p_duration_minutes int,
  p_nickname text,
  p_workout jsonb,
  p_template_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_session_id uuid;
  v_host_token text;
  v_participant_id uuid;
  v_nickname text;
  v_claim_token text;
  v_claim_hash text;
  v_template_id text;
BEGIN
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

  v_host_token := gen_random_uuid()::text;
  v_claim_token :=
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

  INSERT INTO public.sessions (
    host_token,
    duration_minutes,
    workout,
    template_id,
    state,
    time_left_sec
  )
  VALUES (
    v_host_token,
    p_duration_minutes,
    p_workout,
    v_template_id,
    'waiting',
    10
  )
  RETURNING id INTO v_session_id;

  INSERT INTO public.participants (session_id, nickname, role, claim_token_hash)
  VALUES (v_session_id, v_nickname, 'host', v_claim_hash)
  RETURNING id INTO v_participant_id;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'host_token', v_host_token,
    'participant_id', v_participant_id,
    'claim_token', v_claim_token
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_session(int, text, jsonb, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_session(
  p_duration_minutes int,
  p_nickname text,
  p_workout jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  RETURN public.create_session(p_duration_minutes, p_nickname, p_workout, NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_session(int, text, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.available_ghosts(
  p_template_id text,
  p_duration_minutes int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_template_id text;
  v_personal_best jsonb;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_template_id := trim(p_template_id);
  IF v_template_id IS NULL OR v_template_id = '' OR length(v_template_id) > 120 THEN
    RAISE EXCEPTION 'Invalid template id';
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes < 1 OR p_duration_minutes > 60 THEN
    RAISE EXCEPTION 'Duration must be between 1 and 60 minutes';
  END IF;

  SELECT jsonb_build_object(
    'session_id', s.id,
    'participant_id', p.id,
    'nickname', p.nickname,
    'final_score', psr.final_score,
    'base_score', (
      (
        SELECT count(*)::int
        FROM public.rounds r
        WHERE r.participant_id = p.id
          AND r.segment_index = s.segment_index
      ) * public.compute_reps_per_round(s.workout)
      + psr.partial_reps
    ),
    'created_at', s.created_at
  )
  INTO v_personal_best
  FROM public.participants p
  INNER JOIN public.sessions s ON s.id = p.session_id
  INNER JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
    AND psr.segment_index = s.segment_index
  WHERE p.user_id = v_uid
    AND s.template_id = v_template_id
    AND s.duration_minutes = p_duration_minutes
    AND psr.final_score IS NOT NULL
    AND psr.score_breakdown IS NOT NULL
  ORDER BY psr.final_score DESC, s.created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'personal_best', v_personal_best,
    'friends', '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.available_ghosts(text, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.ghost_curve_data(
  p_session_id uuid,
  p_participant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_owner uuid;
  v_session public.sessions%ROWTYPE;
  v_partial_reps int;
  v_rounds jsonb;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT p.user_id
  INTO v_owner
  FROM public.participants p
  WHERE p.id = p_participant_id
    AND p.session_id = p_session_id;

  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'participant_not_found');
  END IF;

  IF v_owner <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT *
  INTO v_session
  FROM public.sessions
  WHERE id = p_session_id;

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session_not_found');
  END IF;

  SELECT coalesce(psr.partial_reps, 0)
  INTO v_partial_reps
  FROM public.participant_segment_results psr
  WHERE psr.participant_id = p_participant_id
    AND psr.segment_index = v_session.segment_index;

  IF v_partial_reps IS NULL THEN
    v_partial_reps := 0;
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'round_index', r.round_index,
        'elapsed_sec_at_round', r.elapsed_sec_at_round
      )
      ORDER BY r.round_index ASC
    ),
    '[]'::jsonb
  )
  INTO v_rounds
  FROM public.rounds r
  WHERE r.participant_id = p_participant_id
    AND r.segment_index = v_session.segment_index;

  RETURN jsonb_build_object(
    'ok', true,
    'session_id', p_session_id,
    'participant_id', p_participant_id,
    'segment_index', v_session.segment_index,
    'duration_minutes', v_session.duration_minutes,
    'workout', v_session.workout,
    'partial_reps', v_partial_reps,
    'rounds', v_rounds
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ghost_curve_data(uuid, uuid) TO authenticated;
