-- Phase 5: Intake Dossier — athlete_profiles + create_session auth/dossier gate

CREATE TABLE IF NOT EXISTS public.athlete_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  height_cm int NOT NULL,
  weight_kg numeric(5, 1) NOT NULL,
  birth_year int NOT NULL,
  perceived_classification text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT athlete_profiles_height_range CHECK (height_cm BETWEEN 100 AND 250),
  CONSTRAINT athlete_profiles_weight_range CHECK (weight_kg BETWEEN 30 AND 250),
  CONSTRAINT athlete_profiles_birth_year_range CHECK (birth_year BETWEEN 1900 AND 2100),
  CONSTRAINT athlete_profiles_perceived_check CHECK (
    perceived_classification IN ('civilian', 'operator', 'special_ops')
  )
);

REVOKE ALL ON TABLE public.athlete_profiles FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.athlete_rank_ordinal(p_rank text)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_rank
    WHEN 'unclassified' THEN 0
    WHEN 'civilian' THEN 1
    WHEN 'operator' THEN 2
    WHEN 'special_ops' THEN 3
    ELSE -1
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_athlete_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_row public.athlete_profiles%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO v_row
  FROM public.athlete_profiles
  WHERE user_id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'profile', jsonb_build_object(
      'heightCm', v_row.height_cm,
      'weightKg', v_row.weight_kg,
      'birthYear', v_row.birth_year,
      'perceivedClassification', v_row.perceived_classification
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_athlete_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_athlete_profile(
  p_height_cm int,
  p_weight_kg numeric,
  p_birth_year int,
  p_perceived_classification text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_existing text;
  v_min_year int;
  v_row public.athlete_profiles%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_height_cm IS NULL OR p_height_cm < 100 OR p_height_cm > 250 THEN
    RAISE EXCEPTION 'Height must be between 100 and 250 cm';
  END IF;

  IF p_weight_kg IS NULL OR p_weight_kg < 30 OR p_weight_kg > 250 THEN
    RAISE EXCEPTION 'Weight must be between 30 and 250 kg';
  END IF;

  v_min_year := extract(year FROM now())::int - 13;
  IF p_birth_year IS NULL OR p_birth_year < 1900 OR p_birth_year > v_min_year THEN
    RAISE EXCEPTION 'Birth year is out of range';
  END IF;

  IF p_perceived_classification IS NULL
     OR public.athlete_rank_ordinal(p_perceived_classification) < 1
  THEN
    RAISE EXCEPTION 'Perceived classification is required';
  END IF;

  SELECT perceived_classification
  INTO v_existing
  FROM public.athlete_profiles
  WHERE user_id = v_uid;

  IF FOUND
     AND public.athlete_rank_ordinal(p_perceived_classification)
       < public.athlete_rank_ordinal(v_existing)
  THEN
    RAISE EXCEPTION 'Cannot downgrade perceived classification';
  END IF;

  INSERT INTO public.athlete_profiles (
    user_id,
    height_cm,
    weight_kg,
    birth_year,
    perceived_classification,
    updated_at
  )
  VALUES (
    v_uid,
    p_height_cm,
    p_weight_kg,
    p_birth_year,
    p_perceived_classification,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
    SET height_cm = EXCLUDED.height_cm,
        weight_kg = EXCLUDED.weight_kg,
        birth_year = EXCLUDED.birth_year,
        perceived_classification = EXCLUDED.perceived_classification,
        updated_at = now();

  SELECT *
  INTO v_row
  FROM public.athlete_profiles
  WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'ok', true,
    'profile', jsonb_build_object(
      'heightCm', v_row.height_cm,
      'weightKg', v_row.weight_kg,
      'birthYear', v_row.birth_year,
      'perceivedClassification', v_row.perceived_classification
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_athlete_profile(int, numeric, int, text) TO authenticated;

-- Gate create_session: authenticated + dossier required
CREATE OR REPLACE FUNCTION public.create_session(
  p_duration_minutes int,
  p_nickname text,
  p_workout jsonb,
  p_template_id text DEFAULT NULL,
  p_intensity_tier int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_session_id uuid;
  v_host_token text;
  v_participant_id uuid;
  v_nickname text;
  v_claim_token text;
  v_claim_hash text;
  v_template_id text;
  v_intensity_tier int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.athlete_profiles WHERE user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Intake required';
  END IF;

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

  v_intensity_tier := NULL;
  IF p_intensity_tier IS NOT NULL THEN
    IF p_intensity_tier < 1 OR p_intensity_tier > 5 THEN
      RAISE EXCEPTION 'Intensity tier must be between 1 and 5';
    END IF;
    v_intensity_tier := p_intensity_tier;
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
    intensity_tier,
    state,
    time_left_sec
  )
  VALUES (
    v_host_token,
    p_duration_minutes,
    p_workout,
    v_template_id,
    v_intensity_tier,
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

REVOKE EXECUTE ON FUNCTION public.create_session(int, text, jsonb, text, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_session(int, text, jsonb, text, int) TO authenticated;

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
  RETURN public.create_session(p_duration_minutes, p_nickname, p_workout, NULL, NULL);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_session(int, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_session(int, text, jsonb) TO authenticated;
