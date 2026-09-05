-- Phase 2 JIT onboarding: allow athlete_profiles rows with identity only
-- (username + nickname). Body metrics and rank become optional.

ALTER TABLE public.athlete_profiles
  ALTER COLUMN height_cm DROP NOT NULL,
  ALTER COLUMN weight_kg DROP NOT NULL,
  ALTER COLUMN birth_year DROP NOT NULL,
  ALTER COLUMN biological_sex DROP NOT NULL,
  ALTER COLUMN perceived_classification DROP NOT NULL;

ALTER TABLE public.athlete_profiles
  ALTER COLUMN biological_sex DROP DEFAULT;

-- Reaffirm CHECK constraints still allow NULL (Postgres skips CHECK when NULL).
ALTER TABLE public.athlete_profiles
  DROP CONSTRAINT IF EXISTS athlete_profiles_height_range;
ALTER TABLE public.athlete_profiles
  ADD CONSTRAINT athlete_profiles_height_range
  CHECK (height_cm IS NULL OR height_cm BETWEEN 100 AND 250);

ALTER TABLE public.athlete_profiles
  DROP CONSTRAINT IF EXISTS athlete_profiles_weight_range;
ALTER TABLE public.athlete_profiles
  ADD CONSTRAINT athlete_profiles_weight_range
  CHECK (weight_kg IS NULL OR weight_kg BETWEEN 30 AND 250);

ALTER TABLE public.athlete_profiles
  DROP CONSTRAINT IF EXISTS athlete_profiles_birth_year_range;
ALTER TABLE public.athlete_profiles
  ADD CONSTRAINT athlete_profiles_birth_year_range
  CHECK (birth_year IS NULL OR birth_year BETWEEN 1900 AND 2100);

ALTER TABLE public.athlete_profiles
  DROP CONSTRAINT IF EXISTS athlete_profiles_perceived_check;
ALTER TABLE public.athlete_profiles
  ADD CONSTRAINT athlete_profiles_perceived_check
  CHECK (
    perceived_classification IS NULL
    OR perceived_classification IN ('civilian', 'operator', 'special_ops')
  );

ALTER TABLE public.athlete_profiles
  DROP CONSTRAINT IF EXISTS athlete_profiles_biological_sex_check;
ALTER TABLE public.athlete_profiles
  ADD CONSTRAINT athlete_profiles_biological_sex_check
  CHECK (biological_sex IS NULL OR biological_sex IN ('M', 'F'));

-- Username / nickname format + uniqueness unchanged (from prior migrations).

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

-- Identity-only upsert: does not touch metrics / rank columns.
CREATE OR REPLACE FUNCTION public.upsert_athlete_identity(
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
  v_row public.athlete_profiles%ROWTYPE;
  v_username text;
  v_nickname text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
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

  BEGIN
    INSERT INTO public.athlete_profiles (
      user_id,
      username,
      nickname,
      updated_at
    )
    VALUES (
      v_uid,
      v_username,
      v_nickname,
      now()
    )
    ON CONFLICT (user_id) DO UPDATE
      SET username = EXCLUDED.username,
          nickname = EXCLUDED.nickname,
          updated_at = now();
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'That username is already taken';
  END;

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

REVOKE EXECUTE ON FUNCTION public.upsert_athlete_identity(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_athlete_identity(text, text) TO authenticated;
