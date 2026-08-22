-- PR 3 review fixes: pgcrypto search_path, workout NULL guard, rounds FK, participant grants

CREATE OR REPLACE FUNCTION public.validate_workout(p_workout jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_len int;
  v_elem jsonb;
  v_name text;
  v_target int;
  v_unit text;
  i int;
BEGIN
  IF p_workout IS NULL OR jsonb_typeof(p_workout) <> 'array' THEN
    RETURN false;
  END IF;

  v_len := jsonb_array_length(p_workout);
  IF v_len < 1 OR v_len > 20 THEN
    RETURN false;
  END IF;

  FOR i IN 0..(v_len - 1) LOOP
    v_elem := p_workout -> i;
    IF jsonb_typeof(v_elem) <> 'object' THEN
      RETURN false;
    END IF;

    v_name := trim(both from v_elem ->> 'name');
    IF v_name IS NULL OR v_name = '' OR length(v_name) > 120 THEN
      RETURN false;
    END IF;

    IF v_elem ? 'target' THEN
      BEGIN
        v_target := (v_elem ->> 'target')::int;
      EXCEPTION
        WHEN OTHERS THEN
          RETURN false;
      END;
      IF v_target IS NULL OR v_target <= 0 THEN
        RETURN false;
      END IF;
    END IF;

    IF v_elem ? 'unit' THEN
      v_unit := v_elem ->> 'unit';
      IF v_unit IS NULL OR length(v_unit) > 32 THEN
        RETURN false;
      END IF;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

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
DECLARE
  v_session_id uuid;
  v_host_token text;
  v_participant_id uuid;
  v_nickname text;
  v_claim_token text;
  v_claim_hash text;
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

  v_host_token := gen_random_uuid()::text;
  v_claim_token :=
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

  INSERT INTO public.sessions (
    host_token,
    duration_minutes,
    workout,
    state,
    time_left_sec
  )
  VALUES (
    v_host_token,
    p_duration_minutes,
    p_workout,
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

CREATE OR REPLACE FUNCTION public.join_session(
  p_session_id uuid,
  p_nickname text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_count int;
  v_participant_id uuid;
  v_nickname text;
  v_claim_token text;
  v_claim_hash text;
BEGIN
  v_nickname := trim(p_nickname);
  IF v_nickname IS NULL OR v_nickname = '' OR length(v_nickname) > 50 THEN
    RAISE EXCEPTION 'Name or nickname is required (max 50 characters)';
  END IF;

  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  PERFORM id
  FROM public.sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.participants
  WHERE session_id = p_session_id;

  IF v_count >= 6 THEN
    RAISE EXCEPTION 'Session is full (max 6 participants)';
  END IF;

  v_claim_token :=
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

  INSERT INTO public.participants (session_id, nickname, role, claim_token_hash)
  VALUES (p_session_id, v_nickname, 'joiner', v_claim_hash)
  RETURNING id INTO v_participant_id;

  RETURN jsonb_build_object(
    'participant_id', v_participant_id,
    'claim_token', v_claim_token
  );
END;
$$;

REVOKE SELECT ON public.participants FROM anon, authenticated;

GRANT SELECT (id, session_id, nickname, role, joined_at)
  ON public.participants TO anon, authenticated;

ALTER TABLE public.participants
  DROP CONSTRAINT IF EXISTS participants_session_id_id_unique;

ALTER TABLE public.participants
  ADD CONSTRAINT participants_session_id_id_unique UNIQUE (session_id, id);

ALTER TABLE public.rounds
  DROP CONSTRAINT IF EXISTS rounds_session_participant_consistency;

ALTER TABLE public.rounds
  ADD CONSTRAINT rounds_session_participant_consistency
  FOREIGN KEY (session_id, participant_id)
  REFERENCES public.participants (session_id, id);
