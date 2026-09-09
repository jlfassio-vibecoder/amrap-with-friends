-- Add 72-hour and 7-day domain minute buckets alongside the existing 30-day
-- domain matrix. Same eligibility and intensity/duration filters; one scan
-- with lock-time FILTER windows so the three matrices cannot diverge.

CREATE OR REPLACE FUNCTION public.hud_telemetry(p_timezone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
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
  v_week_pvi_missions jsonb;
  v_last_locked_at timestamptz;
  v_attrition jsonb;
  v_weeks jsonb;
  v_domain_5 int;
  v_domain_10 int;
  v_domain_15 int;
  v_domain_20 int;
  v_domain_other int;
  v_domain_active_recovery int;
  v_domain_72h_5 int;
  v_domain_72h_10 int;
  v_domain_72h_15 int;
  v_domain_72h_20 int;
  v_domain_72h_other int;
  v_domain_72h_active_recovery int;
  v_domain_7d_5 int;
  v_domain_7d_10 int;
  v_domain_7d_15 int;
  v_domain_7d_20 int;
  v_domain_7d_other int;
  v_domain_7d_active_recovery int;
  v_i3_plus int;
  v_i4_plus int;
  v_marathon_20 int;
  v_prev_minutes int;
  v_prev_i3_plus int;
  v_prev_i4_plus int;
  v_prev_marathon_20 int;
  v_current_rank text;
  v_previous_rank text;
  v_last_verified_rank text;
  v_birth_year int;
  v_sex text;
  v_age int;
  v_civilian_minutes int;
  v_operator_minutes int;
  v_operator_i3 int;
  v_activity7d_mission_count int;
  v_activity7d_minutes int;
  v_activity7d_avg_intensity numeric;
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
      count(*) FILTER (WHERE s.duration_minutes >= 18),
      0
    )::int
  INTO
    v_week_minutes,
    v_week_pvi_average,
    v_i3_plus,
    v_i4_plus,
    v_marathon_20
  FROM public.participants p
  INNER JOIN public.missions s ON s.id = p.mission_id
  INNER JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
   AND psr.segment_index = s.segment_index
  WHERE p.user_id = v_uid
    AND psr.score_breakdown IS NOT NULL
    AND coalesce(psr.locked_at, psr.updated_at) >= v_week_start_ts
    AND coalesce(psr.locked_at, psr.updated_at) < v_week_end_ts;

  -- Same week filter as weekPviAverage so the mean and the list cannot drift.
  SELECT coalesce(
    jsonb_agg(mission_row ORDER BY lock_ts DESC),
    '[]'::jsonb
  )
  INTO v_week_pvi_missions
  FROM (
    SELECT
      jsonb_build_object(
        'missionId', s.id,
        'pvi', round((psr.score_breakdown ->> 'pvi')::numeric, 1),
        'durationMinutes', s.duration_minutes,
        'templateId', s.template_id,
        'lockedAt', coalesce(psr.locked_at, psr.updated_at)
      ) AS mission_row,
      coalesce(psr.locked_at, psr.updated_at) AS lock_ts
    FROM public.participants p
    INNER JOIN public.missions s ON s.id = p.mission_id
    INNER JOIN public.participant_segment_results psr
      ON psr.participant_id = p.id
     AND psr.segment_index = s.segment_index
    WHERE p.user_id = v_uid
      AND psr.score_breakdown IS NOT NULL
      AND jsonb_typeof(psr.score_breakdown -> 'pvi') = 'number'
      AND coalesce(psr.locked_at, psr.updated_at) >= v_week_start_ts
      AND coalesce(psr.locked_at, psr.updated_at) < v_week_end_ts
  ) AS week_pvi_rows;

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
      count(*) FILTER (WHERE s.duration_minutes >= 18),
      0
    )::int
  INTO
    v_prev_minutes,
    v_prev_i3_plus,
    v_prev_i4_plus,
    v_prev_marathon_20
  FROM public.participants p
  INNER JOIN public.missions s ON s.id = p.mission_id
  INNER JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
   AND psr.segment_index = s.segment_index
  WHERE p.user_id = v_uid
    AND psr.score_breakdown IS NOT NULL
    AND coalesce(psr.locked_at, psr.updated_at) >= v_prev_week_start_ts
    AND coalesce(psr.locked_at, psr.updated_at) < v_prev_week_end_ts;

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

  SELECT new_value
  INTO v_last_verified_rank
  FROM public.athlete_classification_history
  WHERE user_id = v_uid AND kind = 'verified'
  ORDER BY occurred_at DESC
  LIMIT 1;

  IF v_last_verified_rank IS DISTINCT FROM v_current_rank THEN
    INSERT INTO public.athlete_classification_history (user_id, kind, previous_value, new_value)
    VALUES (v_uid, 'verified', v_last_verified_rank, v_current_rank);
  END IF;

  SELECT max(coalesce(psr.locked_at, psr.updated_at))
  INTO v_last_locked_at
  FROM public.participants p
  INNER JOIN public.missions s ON s.id = p.mission_id
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
    LEFT JOIN public.missions s
      ON s.id = p.mission_id
    LEFT JOIN public.participant_segment_results psr
      ON psr.participant_id = p.id
     AND psr.segment_index = s.segment_index
     AND psr.score_breakdown IS NOT NULL
     AND coalesce(psr.locked_at, psr.updated_at) >= wb.week_start_ts
     AND coalesce(psr.locked_at, psr.updated_at) < wb.week_end_ts
    GROUP BY wb.week_index
  )
  SELECT coalesce(
    jsonb_agg((wm.minutes >= v_civilian_minutes) ORDER BY wm.week_index),
    '[]'::jsonb
  )
  INTO v_attrition
  FROM week_minutes wm;

  -- The same 12 local weeks the attrition strip walks, kept whole instead of
  -- reduced to a bit. Deliberately a second pass over the same window rather
  -- than a wider version of the block above: attrition ships today, and this
  -- keeps its query untouched so the grid cannot regress behind a new field.
  -- weeks[0] = oldest (11 weeks ago); weeks[11] = current week.
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
  week_missions AS (
    SELECT
      wb.week_index,
      s.id AS mission_id,
      s.duration_minutes,
      s.template_id,
      psr.final_score,
      -- Same guard weekPviAverage uses: a breakdown can carry a null pvi.
      CASE
        WHEN jsonb_typeof(psr.score_breakdown -> 'pvi') = 'number'
        THEN (psr.score_breakdown ->> 'pvi')::numeric
        ELSE NULL
      END AS pvi,
      coalesce(psr.locked_at, psr.updated_at) AS locked_at
    FROM week_bounds wb
    INNER JOIN public.participants p
      ON p.user_id = v_uid
    INNER JOIN public.missions s
      ON s.id = p.mission_id
    INNER JOIN public.participant_segment_results psr
      ON psr.participant_id = p.id
     AND psr.segment_index = s.segment_index
    WHERE psr.score_breakdown IS NOT NULL
      AND coalesce(psr.locked_at, psr.updated_at) >= wb.week_start_ts
      AND coalesce(psr.locked_at, psr.updated_at) < wb.week_end_ts
  ),
  week_agg AS (
    SELECT
      wb.week_index,
      wb.week_start_ts,
      coalesce(sum(wm.duration_minutes), 0)::int AS minutes,
      count(wm.mission_id)::int AS mission_count,
      coalesce(sum(wm.final_score), 0)::int AS score,
      avg(wm.pvi) AS pvi_average,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'missionId', wm.mission_id,
            'pvi', round(wm.pvi, 1),
            'durationMinutes', wm.duration_minutes,
            'templateId', wm.template_id,
            'lockedAt', wm.locked_at,
            'finalScore', wm.final_score
          )
          ORDER BY wm.locked_at DESC
        ) FILTER (WHERE wm.mission_id IS NOT NULL),
        '[]'::jsonb
      ) AS missions
    FROM week_bounds wb
    LEFT JOIN week_missions wm
      ON wm.week_index = wb.week_index
    GROUP BY wb.week_index, wb.week_start_ts
  )
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'weekStart', to_jsonb(wa.week_start_ts),
        'minutes', wa.minutes,
        'compliant', (wa.minutes >= v_civilian_minutes),
        'missionCount', wa.mission_count,
        'score', wa.score,
        'pviAverage',
          CASE
            WHEN wa.pvi_average IS NULL THEN NULL
            ELSE round(wa.pvi_average, 1)
          END,
        'missions', wa.missions
      )
      ORDER BY wa.week_index
    ),
    '[]'::jsonb
  )
  INTO v_weeks
  FROM week_agg wa;

  -- One scan for 72h / 7d / 30d domain matrices. Lock window is the only
  -- difference; intensity and duration buckets stay identical.
  SELECT
    coalesce(
      sum(s.duration_minutes) FILTER (
        WHERE coalesce(psr.locked_at, psr.updated_at) >= now() - interval '72 hours'
          AND coalesce(s.intensity_tier, 2) <> 1
          AND s.duration_minutes BETWEEN 3 AND 5
      ),
      0
    )::int,
    coalesce(
      sum(s.duration_minutes) FILTER (
        WHERE coalesce(psr.locked_at, psr.updated_at) >= now() - interval '72 hours'
          AND coalesce(s.intensity_tier, 2) <> 1
          AND s.duration_minutes BETWEEN 7 AND 10
      ),
      0
    )::int,
    coalesce(
      sum(s.duration_minutes) FILTER (
        WHERE coalesce(psr.locked_at, psr.updated_at) >= now() - interval '72 hours'
          AND coalesce(s.intensity_tier, 2) <> 1
          AND s.duration_minutes BETWEEN 12 AND 15
      ),
      0
    )::int,
    coalesce(
      sum(s.duration_minutes) FILTER (
        WHERE coalesce(psr.locked_at, psr.updated_at) >= now() - interval '72 hours'
          AND coalesce(s.intensity_tier, 2) <> 1
          AND s.duration_minutes >= 18
      ),
      0
    )::int,
    coalesce(
      sum(s.duration_minutes) FILTER (
        WHERE coalesce(psr.locked_at, psr.updated_at) >= now() - interval '72 hours'
          AND coalesce(s.intensity_tier, 2) <> 1
          AND s.duration_minutes NOT BETWEEN 3 AND 5
          AND s.duration_minutes NOT BETWEEN 7 AND 10
          AND s.duration_minutes NOT BETWEEN 12 AND 15
          AND s.duration_minutes < 18
      ),
      0
    )::int,
    coalesce(
      sum(s.duration_minutes) FILTER (
        WHERE coalesce(psr.locked_at, psr.updated_at) >= now() - interval '72 hours'
          AND s.intensity_tier = 1
      ),
      0
    )::int,
    coalesce(
      sum(s.duration_minutes) FILTER (
        WHERE coalesce(psr.locked_at, psr.updated_at) >= now() - interval '7 days'
          AND coalesce(s.intensity_tier, 2) <> 1
          AND s.duration_minutes BETWEEN 3 AND 5
      ),
      0
    )::int,
    coalesce(
      sum(s.duration_minutes) FILTER (
        WHERE coalesce(psr.locked_at, psr.updated_at) >= now() - interval '7 days'
          AND coalesce(s.intensity_tier, 2) <> 1
          AND s.duration_minutes BETWEEN 7 AND 10
      ),
      0
    )::int,
    coalesce(
      sum(s.duration_minutes) FILTER (
        WHERE coalesce(psr.locked_at, psr.updated_at) >= now() - interval '7 days'
          AND coalesce(s.intensity_tier, 2) <> 1
          AND s.duration_minutes BETWEEN 12 AND 15
      ),
      0
    )::int,
    coalesce(
      sum(s.duration_minutes) FILTER (
        WHERE coalesce(psr.locked_at, psr.updated_at) >= now() - interval '7 days'
          AND coalesce(s.intensity_tier, 2) <> 1
          AND s.duration_minutes >= 18
      ),
      0
    )::int,
    coalesce(
      sum(s.duration_minutes) FILTER (
        WHERE coalesce(psr.locked_at, psr.updated_at) >= now() - interval '7 days'
          AND coalesce(s.intensity_tier, 2) <> 1
          AND s.duration_minutes NOT BETWEEN 3 AND 5
          AND s.duration_minutes NOT BETWEEN 7 AND 10
          AND s.duration_minutes NOT BETWEEN 12 AND 15
          AND s.duration_minutes < 18
      ),
      0
    )::int,
    coalesce(
      sum(s.duration_minutes) FILTER (
        WHERE coalesce(psr.locked_at, psr.updated_at) >= now() - interval '7 days'
          AND s.intensity_tier = 1
      ),
      0
    )::int,
    coalesce(
      sum(s.duration_minutes) FILTER (
        WHERE coalesce(psr.locked_at, psr.updated_at) >= now() - interval '30 days'
          AND coalesce(s.intensity_tier, 2) <> 1
          AND s.duration_minutes BETWEEN 3 AND 5
      ),
      0
    )::int,
    coalesce(
      sum(s.duration_minutes) FILTER (
        WHERE coalesce(psr.locked_at, psr.updated_at) >= now() - interval '30 days'
          AND coalesce(s.intensity_tier, 2) <> 1
          AND s.duration_minutes BETWEEN 7 AND 10
      ),
      0
    )::int,
    coalesce(
      sum(s.duration_minutes) FILTER (
        WHERE coalesce(psr.locked_at, psr.updated_at) >= now() - interval '30 days'
          AND coalesce(s.intensity_tier, 2) <> 1
          AND s.duration_minutes BETWEEN 12 AND 15
      ),
      0
    )::int,
    coalesce(
      sum(s.duration_minutes) FILTER (
        WHERE coalesce(psr.locked_at, psr.updated_at) >= now() - interval '30 days'
          AND coalesce(s.intensity_tier, 2) <> 1
          AND s.duration_minutes >= 18
      ),
      0
    )::int,
    coalesce(
      sum(s.duration_minutes) FILTER (
        WHERE coalesce(psr.locked_at, psr.updated_at) >= now() - interval '30 days'
          AND coalesce(s.intensity_tier, 2) <> 1
          AND s.duration_minutes NOT BETWEEN 3 AND 5
          AND s.duration_minutes NOT BETWEEN 7 AND 10
          AND s.duration_minutes NOT BETWEEN 12 AND 15
          AND s.duration_minutes < 18
      ),
      0
    )::int,
    coalesce(
      sum(s.duration_minutes) FILTER (
        WHERE coalesce(psr.locked_at, psr.updated_at) >= now() - interval '30 days'
          AND s.intensity_tier = 1
      ),
      0
    )::int
  INTO
    v_domain_72h_5,
    v_domain_72h_10,
    v_domain_72h_15,
    v_domain_72h_20,
    v_domain_72h_other,
    v_domain_72h_active_recovery,
    v_domain_7d_5,
    v_domain_7d_10,
    v_domain_7d_15,
    v_domain_7d_20,
    v_domain_7d_other,
    v_domain_7d_active_recovery,
    v_domain_5,
    v_domain_10,
    v_domain_15,
    v_domain_20,
    v_domain_other,
    v_domain_active_recovery
  FROM public.participants p
  INNER JOIN public.missions s ON s.id = p.mission_id
  INNER JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
   AND psr.segment_index = s.segment_index
  WHERE p.user_id = v_uid
    AND psr.score_breakdown IS NOT NULL
    AND coalesce(psr.locked_at, psr.updated_at) >= now() - interval '30 days';


  SELECT
    coalesce(count(*), 0)::int,
    coalesce(sum(s.duration_minutes), 0)::int,
    avg(coalesce(s.intensity_tier, 2))
  INTO
    v_activity7d_mission_count,
    v_activity7d_minutes,
    v_activity7d_avg_intensity
  FROM public.participants p
  INNER JOIN public.missions s ON s.id = p.mission_id
  INNER JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
   AND psr.segment_index = s.segment_index
  WHERE p.user_id = v_uid
    AND psr.score_breakdown IS NOT NULL
    AND coalesce(psr.locked_at, psr.updated_at) >= now() - interval '7 days';

  RETURN jsonb_build_object(
    'ok', true,
    'telemetry', jsonb_build_object(
      'weekMinutes', v_week_minutes,
      'weekPviAverage',
        CASE
          WHEN v_week_pvi_average IS NULL THEN NULL
          ELSE round(v_week_pvi_average, 1)
        END,
      'weekPviMissions', coalesce(v_week_pvi_missions, '[]'::jsonb),
      'weekEndsAt', to_jsonb(v_week_end_ts),
      'lastLockedAt', to_jsonb(v_last_locked_at),
      'attrition', v_attrition,
      'weeks', coalesce(v_weeks, '[]'::jsonb),
      'domainMinutes72h', jsonb_build_object(
        '5', v_domain_72h_5,
        '10', v_domain_72h_10,
        '15', v_domain_72h_15,
        '20', v_domain_72h_20,
        'other', v_domain_72h_other,
        'activeRecovery', v_domain_72h_active_recovery
      ),
      'domainMinutes7d', jsonb_build_object(
        '5', v_domain_7d_5,
        '10', v_domain_7d_10,
        '15', v_domain_7d_15,
        '20', v_domain_7d_20,
        'other', v_domain_7d_other,
        'activeRecovery', v_domain_7d_active_recovery
      ),
      'domainMinutes30d', jsonb_build_object(
        '5', v_domain_5,
        '10', v_domain_10,
        '15', v_domain_15,
        '20', v_domain_20,
        'other', v_domain_other,
        'activeRecovery', v_domain_active_recovery
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
      ),
      'activity7d', jsonb_build_object(
        'missionCount', v_activity7d_mission_count,
        'minutes', v_activity7d_minutes,
        'avgIntensity',
          CASE
            WHEN v_activity7d_mission_count = 0 THEN NULL
            ELSE round(v_activity7d_avg_intensity, 1)
          END
      ),
      'overtraining', public.compute_overtraining_load(v_uid, p_timezone)
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.hud_telemetry(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hud_telemetry(text) TO authenticated;
