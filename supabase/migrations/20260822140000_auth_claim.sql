-- PR 5: Auth claim — participants.user_id, claim_participant RPC, log_round auth fallback

ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_participants_user_id
  ON public.participants (user_id)
  WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_participant_claim_status(p_participant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_user_id uuid;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_participant_id IS NULL THEN
    RAISE EXCEPTION 'Invalid participant';
  END IF;

  SELECT user_id
  INTO v_user_id
  FROM public.participants
  WHERE id = p_participant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'participant_not_found');
  END IF;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'status', 'claimable');
  ELSIF v_user_id = v_uid THEN
    RETURN jsonb_build_object('ok', true, 'status', 'claimed');
  ELSE
    RETURN jsonb_build_object('ok', true, 'status', 'claimed_by_other');
  END IF;
END;
$$;

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

CREATE OR REPLACE FUNCTION public.claim_participant(
  p_participant_id uuid,
  p_claim_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_session_id uuid;
  v_claim_token_hash text;
  v_user_id uuid;
  v_hash text;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_participant_id IS NULL OR p_claim_token IS NULL THEN
    RAISE EXCEPTION 'Invalid claim';
  END IF;

  SELECT session_id, claim_token_hash, user_id
  INTO v_session_id, v_claim_token_hash, v_user_id
  FROM public.participants
  WHERE id = p_participant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participant not found';
  END IF;

  IF v_claim_token_hash IS NULL AND v_user_id = v_uid THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_claimed', true,
      'participant_id', p_participant_id,
      'session_id', v_session_id,
      'user_id', v_uid
    );
  END IF;

  IF v_claim_token_hash IS NULL AND v_user_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
  END IF;

  v_hash := encode(digest(p_claim_token, 'sha256'), 'hex');

  IF v_claim_token_hash IS NULL OR v_hash <> v_claim_token_hash THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_claim_token');
  END IF;

  UPDATE public.participants
  SET user_id = v_uid, claim_token_hash = NULL
  WHERE id = p_participant_id;

  RETURN jsonb_build_object(
    'ok', true,
    'participant_id', p_participant_id,
    'session_id', v_session_id,
    'user_id', v_uid
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
  v_participant_user_id uuid;
  v_session_state text;
  v_session_segment_index int;
  v_duration_minutes int;
  v_max_work_sec int;
  v_round_count int;
  v_round_id uuid;
  v_hash text;
  v_uid uuid;
  v_authorized boolean := false;
BEGIN
  v_uid := auth.uid();

  IF p_session_id IS NULL OR p_participant_id IS NULL OR p_claim_token IS NULL THEN
    RAISE EXCEPTION 'Invalid round log';
  END IF;

  IF p_round_index < 0 OR p_elapsed_sec_at_round < 0 OR p_segment_index < 0 THEN
    RAISE EXCEPTION 'Invalid round log';
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

GRANT EXECUTE ON FUNCTION public.get_participant_claim_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_participant(uuid, text) TO authenticated;
