-- Phase 5.5: biological sex + biometric classification quotas

ALTER TABLE public.athlete_profiles
  ADD COLUMN IF NOT EXISTS biological_sex text NOT NULL DEFAULT 'M';

ALTER TABLE public.athlete_profiles
  DROP CONSTRAINT IF EXISTS athlete_profiles_biological_sex_check;

ALTER TABLE public.athlete_profiles
  ADD CONSTRAINT athlete_profiles_biological_sex_check
  CHECK (biological_sex IN ('M', 'F'));

CREATE OR REPLACE FUNCTION public.classification_quotas(p_age int, p_sex text)
RETURNS TABLE (
  civilian_minutes int,
  operator_minutes int,
  operator_i3 int
)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    CASE
      WHEN coalesce(p_age, 22) <= 35 AND coalesce(p_sex, 'M') = 'F' THEN 135
      WHEN coalesce(p_age, 22) >= 36 AND coalesce(p_sex, 'M') = 'F' THEN 120
      WHEN coalesce(p_age, 22) >= 36 THEN 135
      ELSE 150
    END,
    CASE
      WHEN coalesce(p_age, 22) <= 35 AND coalesce(p_sex, 'M') = 'F' THEN 220
      WHEN coalesce(p_age, 22) <= 35 THEN 240
      WHEN coalesce(p_age, 22) <= 45 THEN 210
      ELSE 180
    END,
    CASE
      WHEN coalesce(p_age, 22) <= 35 THEN 2
      ELSE 1
    END;
$$;

REVOKE EXECUTE ON FUNCTION public.classification_quotas(int, text) FROM PUBLIC, anon;

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
      'perceivedClassification', v_row.perceived_classification
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_athlete_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_athlete_profile() TO authenticated;

DROP FUNCTION IF EXISTS public.upsert_athlete_profile(int, numeric, int, text);

CREATE OR REPLACE FUNCTION public.upsert_athlete_profile(
  p_height_cm int,
  p_weight_kg numeric,
  p_birth_year int,
  p_perceived_classification text,
  p_biological_sex text
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

  IF p_biological_sex IS NULL OR p_biological_sex NOT IN ('M', 'F') THEN
    RAISE EXCEPTION 'Biological sex is required';
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
    biological_sex,
    perceived_classification,
    updated_at
  )
  VALUES (
    v_uid,
    p_height_cm,
    p_weight_kg,
    p_birth_year,
    p_biological_sex,
    p_perceived_classification,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
    SET height_cm = EXCLUDED.height_cm,
        weight_kg = EXCLUDED.weight_kg,
        birth_year = EXCLUDED.birth_year,
        biological_sex = EXCLUDED.biological_sex,
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
      'biologicalSex', v_row.biological_sex,
      'perceivedClassification', v_row.perceived_classification
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_athlete_profile(int, numeric, int, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_athlete_profile(int, numeric, int, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.hud_telemetry(p_timezone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_local_today date;
  v_week_start_local date;
  v_week_start_ts timestamptz;
  v_week_end_ts timestamptz;
  v_prev_week_start_local date;
  v_prev_week_start_ts timestamptz;
  v_prev_week_end_ts timestamptz;
  v_week_minutes int;
  v_week_pvi_average numeric;
  v_last_locked_at timestamptz;
  v_attrition jsonb;
  v_domain_5 int;
  v_domain_10 int;
  v_domain_15 int;
  v_domain_20 int;
  v_domain_other int;
  v_i3_plus int;
  v_i4_plus int;
  v_marathon_20 int;
  v_prev_minutes int;
  v_prev_i3_plus int;
  v_prev_i4_plus int;
  v_prev_marathon_20 int;
  v_current_rank text;
  v_previous_rank text;
  v_birth_year int;
  v_sex text;
  v_age int;
  v_civilian_minutes int;
  v_operator_minutes int;
  v_operator_i3 int;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_timezone IS NULL
     OR btrim(p_timezone) = ''
     OR NOT EXISTS (
       SELECT 1
       FROM pg_timezone_names
       WHERE name = p_timezone
     )
  THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_timezone');
  END IF;

  SELECT birth_year, biological_sex
  INTO v_birth_year, v_sex
  FROM public.athlete_profiles
  WHERE user_id = v_uid;

  IF NOT FOUND THEN
    v_age := 22;
    v_sex := 'M';
  ELSE
    -- Copilot suggestion ignored: local calendar year on the client mirrors this DB year extract; exact TZ alignment is out of scope for classification quotas.
    v_age := extract(year FROM now())::int - v_birth_year;
    v_sex := coalesce(v_sex, 'M');
  END IF;

  SELECT q.civilian_minutes, q.operator_minutes, q.operator_i3
  INTO v_civilian_minutes, v_operator_minutes, v_operator_i3
  FROM public.classification_quotas(v_age, v_sex) AS q;

  v_local_today := (now() AT TIME ZONE p_timezone)::date;
  -- ISO Monday = 1 … Sunday = 7
  v_week_start_local :=
    v_local_today - ((extract(isodow FROM v_local_today)::int) - 1);

  -- Monday 00:00 local → timestamptz; next Monday 00:00 is exclusive end
  v_week_start_ts := (v_week_start_local::timestamp AT TIME ZONE p_timezone);
  v_week_end_ts := ((v_week_start_local + 7)::timestamp AT TIME ZONE p_timezone);

  v_prev_week_start_local := v_week_start_local - 7;
  v_prev_week_start_ts := (v_prev_week_start_local::timestamp AT TIME ZONE p_timezone);
  v_prev_week_end_ts := v_week_start_ts;

  SELECT
    coalesce(sum(s.duration_minutes), 0)::int,
    avg(
      CASE
        WHEN jsonb_typeof(psr.score_breakdown -> 'pvi') = 'number'
        THEN (psr.score_breakdown ->> 'pvi')::numeric
        ELSE NULL
      END
    ),
    coalesce(
      count(*) FILTER (
        WHERE coalesce(s.intensity_tier, 2) >= 3
      ),
      0
    )::int,
    coalesce(
      count(*) FILTER (
        WHERE coalesce(s.intensity_tier, 2) >= 4
      ),
      0
    )::int,
    coalesce(
      count(*) FILTER (WHERE s.duration_minutes = 20),
      0
    )::int
  INTO
    v_week_minutes,
    v_week_pvi_average,
    v_i3_plus,
    v_i4_plus,
    v_marathon_20
  FROM public.participants p
  INNER JOIN public.sessions s ON s.id = p.session_id
  INNER JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
   AND psr.segment_index = s.segment_index
  WHERE p.user_id = v_uid
    AND psr.score_breakdown IS NOT NULL
    AND psr.updated_at >= v_week_start_ts
    AND psr.updated_at < v_week_end_ts;

  SELECT
    coalesce(sum(s.duration_minutes), 0)::int,
    coalesce(
      count(*) FILTER (
        WHERE coalesce(s.intensity_tier, 2) >= 3
      ),
      0
    )::int,
    coalesce(
      count(*) FILTER (
        WHERE coalesce(s.intensity_tier, 2) >= 4
      ),
      0
    )::int,
    coalesce(
      count(*) FILTER (WHERE s.duration_minutes = 20),
      0
    )::int
  INTO
    v_prev_minutes,
    v_prev_i3_plus,
    v_prev_i4_plus,
    v_prev_marathon_20
  FROM public.participants p
  INNER JOIN public.sessions s ON s.id = p.session_id
  INNER JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
   AND psr.segment_index = s.segment_index
  WHERE p.user_id = v_uid
    AND psr.score_breakdown IS NOT NULL
    AND psr.updated_at >= v_prev_week_start_ts
    AND psr.updated_at < v_prev_week_end_ts;

  -- Highest rank meeting all criteria wins. Special Ops is absolute.
  IF v_week_minutes >= 300 AND v_i4_plus >= 3 AND v_marathon_20 >= 1 THEN
    v_current_rank := 'special_ops';
  ELSIF v_week_minutes >= v_operator_minutes AND v_i3_plus >= v_operator_i3 THEN
    v_current_rank := 'operator';
  ELSIF v_week_minutes >= v_civilian_minutes THEN
    v_current_rank := 'civilian';
  ELSE
    v_current_rank := 'unclassified';
  END IF;

  IF v_prev_minutes >= 300 AND v_prev_i4_plus >= 3 AND v_prev_marathon_20 >= 1 THEN
    v_previous_rank := 'special_ops';
  ELSIF v_prev_minutes >= v_operator_minutes AND v_prev_i3_plus >= v_operator_i3 THEN
    v_previous_rank := 'operator';
  ELSIF v_prev_minutes >= v_civilian_minutes THEN
    v_previous_rank := 'civilian';
  ELSE
    v_previous_rank := 'unclassified';
  END IF;

  SELECT max(psr.updated_at)
  INTO v_last_locked_at
  FROM public.participants p
  INNER JOIN public.sessions s ON s.id = p.session_id
  INNER JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
   AND psr.segment_index = s.segment_index
  WHERE p.user_id = v_uid
    AND psr.score_breakdown IS NOT NULL;

  -- attrition[0] = oldest (11 weeks ago); attrition[11] = current week
  WITH week_starts AS (
    SELECT
      gs AS week_index,
      (v_week_start_local - ((11 - gs) * 7)) AS week_start_local
    FROM generate_series(0, 11) AS gs
  ),
  week_bounds AS (
    SELECT
      week_index,
      week_start_local,
      (week_start_local::timestamp AT TIME ZONE p_timezone) AS week_start_ts,
      ((week_start_local + 7)::timestamp AT TIME ZONE p_timezone) AS week_end_ts
    FROM week_starts
  ),
  week_minutes AS (
    SELECT
      wb.week_index,
      coalesce(
        sum(s.duration_minutes) FILTER (WHERE psr.participant_id IS NOT NULL),
        0
      )::int AS minutes
    FROM week_bounds wb
    LEFT JOIN public.participants p
      ON p.user_id = v_uid
    LEFT JOIN public.sessions s
      ON s.id = p.session_id
    LEFT JOIN public.participant_segment_results psr
      ON psr.participant_id = p.id
     AND psr.segment_index = s.segment_index
     AND psr.score_breakdown IS NOT NULL
     AND psr.updated_at >= wb.week_start_ts
     AND psr.updated_at < wb.week_end_ts
    GROUP BY wb.week_index
  )
  SELECT coalesce(
    jsonb_agg((wm.minutes >= v_civilian_minutes) ORDER BY wm.week_index),
    '[]'::jsonb
  )
  INTO v_attrition
  FROM week_minutes wm;

  SELECT
    coalesce(sum(s.duration_minutes) FILTER (WHERE s.duration_minutes = 5), 0)::int,
    coalesce(sum(s.duration_minutes) FILTER (WHERE s.duration_minutes = 10), 0)::int,
    coalesce(sum(s.duration_minutes) FILTER (WHERE s.duration_minutes = 15), 0)::int,
    coalesce(sum(s.duration_minutes) FILTER (WHERE s.duration_minutes = 20), 0)::int,
    coalesce(
      sum(s.duration_minutes) FILTER (
        WHERE s.duration_minutes NOT IN (5, 10, 15, 20)
      ),
      0
    )::int
  INTO v_domain_5, v_domain_10, v_domain_15, v_domain_20, v_domain_other
  FROM public.participants p
  INNER JOIN public.sessions s ON s.id = p.session_id
  INNER JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
   AND psr.segment_index = s.segment_index
  WHERE p.user_id = v_uid
    AND psr.score_breakdown IS NOT NULL
    AND psr.updated_at >= now() - interval '30 days';

  RETURN jsonb_build_object(
    'ok', true,
    'telemetry', jsonb_build_object(
      'weekMinutes', v_week_minutes,
      'weekPviAverage',
        CASE
          WHEN v_week_pvi_average IS NULL THEN NULL
          ELSE round(v_week_pvi_average, 1)
        END,
      'weekEndsAt', to_jsonb(v_week_end_ts),
      'lastLockedAt', to_jsonb(v_last_locked_at),
      'attrition', v_attrition,
      'domainMinutes30d', jsonb_build_object(
        '5', v_domain_5,
        '10', v_domain_10,
        '15', v_domain_15,
        '20', v_domain_20,
        'other', v_domain_other
      ),
      'classification', jsonb_build_object(
        'current', v_current_rank,
        'previous', v_previous_rank,
        'progress', jsonb_build_object(
          'weekMinutes', v_week_minutes,
          'intensity3PlusCount', v_i3_plus,
          'intensity4PlusCount', v_i4_plus,
          'marathon20Count', v_marathon_20
        )
      )
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hud_telemetry(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hud_telemetry(text) TO authenticated;
