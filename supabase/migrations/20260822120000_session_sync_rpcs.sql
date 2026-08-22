-- PR 4: Live session sync — update_session_state, log_round, rounds read grants, RLS policies, realtime

GRANT SELECT (
  id,
  session_id,
  participant_id,
  round_index,
  elapsed_sec_at_round,
  segment_index,
  created_at
) ON public.rounds TO anon, authenticated;

ALTER TABLE public.rounds REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rounds;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE POLICY sessions_select_anon ON public.sessions
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY participants_select_anon ON public.participants
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY rounds_select_anon ON public.rounds
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.update_session_state(
  p_session_id uuid,
  p_host_token text,
  p_state text,
  p_time_left_sec int,
  p_is_paused boolean,
  p_started_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_host_token text;
  v_duration_minutes int;
  v_max_work_sec int;
  v_effective_paused boolean;
BEGIN
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  SELECT host_token, duration_minutes
  INTO v_host_token, v_duration_minutes
  FROM public.sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF p_host_token IS NULL OR p_host_token <> v_host_token THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_host_token');
  END IF;

  IF p_state NOT IN ('waiting', 'setup', 'work', 'finished') THEN
    RAISE EXCEPTION 'Invalid session state';
  END IF;

  IF p_time_left_sec IS NULL OR p_time_left_sec < 0 THEN
    RAISE EXCEPTION 'Invalid time_left_sec';
  END IF;

  v_max_work_sec := v_duration_minutes * 60;

  IF p_state = 'work' AND p_time_left_sec > v_max_work_sec THEN
    RAISE EXCEPTION 'Invalid time_left_sec';
  END IF;

  IF p_state = 'setup' AND p_time_left_sec > 60 THEN
    RAISE EXCEPTION 'Invalid time_left_sec';
  END IF;

  v_effective_paused := p_state = 'work' AND p_is_paused;

  UPDATE public.sessions
  SET
    state = p_state,
    time_left_sec = p_time_left_sec,
    is_paused = v_effective_paused,
    started_at = CASE
      WHEN p_state = 'work' AND p_started_at IS NOT NULL THEN p_started_at
      WHEN p_state = 'work' THEN started_at
      ELSE NULL
    END
  WHERE id = p_session_id AND host_token = p_host_token;

  RETURN jsonb_build_object(
    'ok', true,
    'session_id', p_session_id,
    'state', p_state,
    'time_left_sec', p_time_left_sec,
    'is_paused', v_effective_paused,
    'started_at', CASE
      WHEN p_state = 'work' AND p_started_at IS NOT NULL THEN p_started_at
      WHEN p_state = 'work' THEN (
        SELECT started_at FROM public.sessions WHERE id = p_session_id
      )
      ELSE NULL
    END,
    'segment_index', (
      SELECT segment_index FROM public.sessions WHERE id = p_session_id
    )
  );
END;
$$;

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

  SELECT state, segment_index
  INTO v_session_state, v_session_segment_index
  FROM public.sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
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

GRANT EXECUTE ON FUNCTION public.update_session_state(
  uuid, text, text, int, boolean, timestamptz
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.log_round(
  uuid, uuid, text, int, int, int
) TO anon, authenticated;
