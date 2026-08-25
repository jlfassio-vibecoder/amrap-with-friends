-- Intake identity: username (profile handle) + nickname (workout callsign)

ALTER TABLE public.athlete_profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS nickname text;

ALTER TABLE public.athlete_profiles
  DROP CONSTRAINT IF EXISTS athlete_profiles_username_format;

ALTER TABLE public.athlete_profiles
  ADD CONSTRAINT athlete_profiles_username_format
  CHECK (
    username IS NULL
    OR (
      length(username) BETWEEN 3 AND 30
      AND username ~ '^[A-Za-z0-9_]+$'
    )
  );

ALTER TABLE public.athlete_profiles
  DROP CONSTRAINT IF EXISTS athlete_profiles_nickname_length;

ALTER TABLE public.athlete_profiles
  ADD CONSTRAINT athlete_profiles_nickname_length
  CHECK (
    nickname IS NULL
    OR (length(trim(nickname)) BETWEEN 1 AND 50)
  );

CREATE UNIQUE INDEX IF NOT EXISTS athlete_profiles_username_lower_uidx
  ON public.athlete_profiles (lower(username))
  WHERE username IS NOT NULL;

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
      'biologicalSex', v_row.biological_sex,
      'perceivedClassification', v_row.perceived_classification,
      'username', v_row.username,
      'nickname', v_row.nickname
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_athlete_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_athlete_profile() TO authenticated;

DROP FUNCTION IF EXISTS public.upsert_athlete_profile(int, numeric, int, text, text);

CREATE OR REPLACE FUNCTION public.upsert_athlete_profile(
  p_height_cm int,
  p_weight_kg numeric,
  p_birth_year int,
  p_perceived_classification text,
  p_biological_sex text,
  p_username text,
  p_nickname text
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
  v_username text;
  v_nickname text;
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

  IF p_biological_sex IS NULL OR p_biological_sex NOT IN ('M', 'F') THEN
    RAISE EXCEPTION 'Biological sex is required';
  END IF;

  IF p_perceived_classification IS NULL
     OR public.athlete_rank_ordinal(p_perceived_classification) < 1
  THEN
    RAISE EXCEPTION 'Perceived classification is required';
  END IF;

  v_username := trim(p_username);
  IF v_username IS NULL OR v_username = '' THEN
    RAISE EXCEPTION 'Username is required (3–30 characters, letters, numbers, underscore)';
  END IF;
  IF length(v_username) < 3 OR length(v_username) > 30 OR v_username !~ '^[A-Za-z0-9_]+$' THEN
    RAISE EXCEPTION 'Username must be 3–30 characters: letters, numbers, underscore only';
  END IF;

  v_nickname := trim(p_nickname);
  IF v_nickname IS NULL OR v_nickname = '' OR length(v_nickname) > 50 THEN
    RAISE EXCEPTION 'Nickname is required (max 50 characters)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.athlete_profiles
    WHERE lower(username) = lower(v_username)
      AND user_id <> v_uid
  ) THEN
    RAISE EXCEPTION 'That username is already taken';
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
    biological_sex,
    perceived_classification,
    username,
    nickname,
    updated_at
  )
  VALUES (
    v_uid,
    p_height_cm,
    p_weight_kg,
    p_birth_year,
    p_biological_sex,
    p_perceived_classification,
    v_username,
    v_nickname,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
    SET height_cm = EXCLUDED.height_cm,
        weight_kg = EXCLUDED.weight_kg,
        birth_year = EXCLUDED.birth_year,
        biological_sex = EXCLUDED.biological_sex,
        perceived_classification = EXCLUDED.perceived_classification,
        username = EXCLUDED.username,
        nickname = EXCLUDED.nickname,
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
      'biologicalSex', v_row.biological_sex,
      'perceivedClassification', v_row.perceived_classification,
      'username', v_row.username,
      'nickname', v_row.nickname
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_athlete_profile(int, numeric, int, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_athlete_profile(int, numeric, int, text, text, text, text) TO authenticated;
