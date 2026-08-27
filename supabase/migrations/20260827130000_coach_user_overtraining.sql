-- Phase D: surface the same overtraining load signal used on the HUD
-- (Phase B/C) inside the Coach dashboard's per-user detail panel, so
-- support staff can see when a specific athlete's acute:chronic load or
-- consecutive high-intensity days looks risky.
--
-- The load computation itself (session-RPE across eligible AMRAP
-- sessions + physical_activity_log) is factored out of hud_telemetry
-- into compute_overtraining_load() so both callers share one
-- implementation. It takes an explicit p_user_id (not auth.uid()) so it
-- can be reused for an arbitrary athlete from coach_user_detail; it is
-- SECURITY DEFINER and NOT granted to any client role — only reachable
-- from other SECURITY DEFINER functions that have already authorized
-- the caller (hud_telemetry checks auth.uid(), coach_user_detail checks
-- is_coach()), matching the classification_quotas() helper pattern.

CREATE OR REPLACE FUNCTION public.compute_overtraining_load(
  p_user_id uuid,
  p_timezone text DEFAULT 'UTC'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_tz text;
  v_local_today date;
  v_amrap_load_7d numeric;
  v_pa_load_7d numeric;
  v_acute_load_7d numeric;
  v_amrap_load_28d numeric;
  v_pa_load_28d numeric;
  v_chronic_weekly_load_28d numeric;
  v_consecutive_hard_days int;
  v_day_offset int;
  v_is_hard_day boolean;
BEGIN
  -- Copilot suggestion ignored: callers already validate timezone (hud_telemetry) or pass UTC (coach_user_detail), and reject null user ids before invoke — matches classification_quotas trust-caller pattern.
  v_tz := coalesce(nullif(btrim(coalesce(p_timezone, '')), ''), 'UTC');
  v_local_today := (now() AT TIME ZONE v_tz)::date;

  SELECT coalesce(sum(s.duration_minutes * coalesce(s.intensity_tier, 2)), 0)
  INTO v_amrap_load_7d
  FROM public.participants p
  INNER JOIN public.sessions s ON s.id = p.session_id
  INNER JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
   AND psr.segment_index = s.segment_index
  WHERE p.user_id = p_user_id
    AND psr.score_breakdown IS NOT NULL
    AND psr.updated_at >= now() - interval '7 days';

  SELECT coalesce(sum(duration_minutes * intensity_tier), 0)
  INTO v_pa_load_7d
  FROM public.physical_activity_log
  WHERE user_id = p_user_id
    AND occurred_at >= now() - interval '7 days';

  v_acute_load_7d := v_amrap_load_7d + v_pa_load_7d;

  SELECT coalesce(sum(s.duration_minutes * coalesce(s.intensity_tier, 2)), 0)
  INTO v_amrap_load_28d
  FROM public.participants p
  INNER JOIN public.sessions s ON s.id = p.session_id
  INNER JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
   AND psr.segment_index = s.segment_index
  WHERE p.user_id = p_user_id
    AND psr.score_breakdown IS NOT NULL
    AND psr.updated_at >= now() - interval '28 days';

  SELECT coalesce(sum(duration_minutes * intensity_tier), 0)
  INTO v_pa_load_28d
  FROM public.physical_activity_log
  WHERE user_id = p_user_id
    AND occurred_at >= now() - interval '28 days';

  v_chronic_weekly_load_28d := (v_amrap_load_28d + v_pa_load_28d) / 4.0;

  -- Consecutive local-calendar days (ending today) with any intensity-4+
  -- activity from either source. Loop bound of 14 is a safety cap well
  -- past the 5-day rest-day threshold the client-side evaluator uses.
  v_consecutive_hard_days := 0;
  FOR v_day_offset IN 0..13 LOOP
    SELECT
      EXISTS (
        SELECT 1
        FROM public.participants p
        INNER JOIN public.sessions s ON s.id = p.session_id
        INNER JOIN public.participant_segment_results psr
          ON psr.participant_id = p.id
         AND psr.segment_index = s.segment_index
        WHERE p.user_id = p_user_id
          AND psr.score_breakdown IS NOT NULL
          AND coalesce(s.intensity_tier, 2) >= 4
          AND psr.updated_at >= ((v_local_today - v_day_offset)::timestamp AT TIME ZONE v_tz)
          AND psr.updated_at < ((v_local_today - v_day_offset + 1)::timestamp AT TIME ZONE v_tz)
      )
      OR EXISTS (
        SELECT 1
        FROM public.physical_activity_log pal
        WHERE pal.user_id = p_user_id
          AND pal.intensity_tier >= 4
          AND pal.occurred_at >= ((v_local_today - v_day_offset)::timestamp AT TIME ZONE v_tz)
          AND pal.occurred_at < ((v_local_today - v_day_offset + 1)::timestamp AT TIME ZONE v_tz)
      )
    INTO v_is_hard_day;

    EXIT WHEN NOT v_is_hard_day;
    v_consecutive_hard_days := v_consecutive_hard_days + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'acuteLoad7d', v_acute_load_7d,
    'chronicWeeklyLoad28d', v_chronic_weekly_load_28d,
    'consecutiveHighIntensityDays', v_consecutive_hard_days
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.compute_overtraining_load(uuid, text) FROM PUBLIC, anon, authenticated;

-- hud_telemetry: swap the inline load computation for the shared helper.
-- Everything else is unchanged from the Phase B definition.
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
  v_last_verified_rank text;
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
      ),
      'overtraining', public.compute_overtraining_load(v_uid, p_timezone)
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hud_telemetry(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hud_telemetry(text) TO authenticated;

-- coach_user_detail: add the same overtraining block for the selected
-- athlete, computed in UTC (coach has no client timezone to hand in).
CREATE OR REPLACE FUNCTION public.coach_user_detail(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'profile', (
      SELECT jsonb_build_object(
        'userId', ap.user_id,
        'username', ap.username,
        'nickname', ap.nickname,
        'email', au.email,
        'heightCm', ap.height_cm,
        'weightKg', ap.weight_kg,
        'birthYear', ap.birth_year,
        'biologicalSex', ap.biological_sex,
        'perceivedClassification', ap.perceived_classification,
        'accountCreatedAt', ap.created_at
      )
      FROM public.athlete_profiles ap
      JOIN auth.users au ON au.id = ap.user_id
      WHERE ap.user_id = p_user_id
    ),
    'classificationHistory', (
      SELECT coalesce(jsonb_agg(h ORDER BY h.occurred_at DESC), '[]'::jsonb)
      FROM public.athlete_classification_history h
      WHERE h.user_id = p_user_id
    ),
    'sessions', (
      SELECT coalesce(jsonb_agg(s ORDER BY s.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          se.id AS session_id,
          p.role,
          se.template_id,
          se.intensity_tier,
          se.duration_minutes,
          se.state,
          psr.final_score,
          se.created_at,
          p.joined_at
        FROM public.participants p
        JOIN public.sessions se ON se.id = p.session_id
        LEFT JOIN public.participant_segment_results psr
          ON psr.participant_id = p.id AND psr.segment_index = se.segment_index
        WHERE p.user_id = p_user_id
      ) s
    ),
    'summary', jsonb_build_object(
      'sessionsAsHost', (
        SELECT count(DISTINCT p.session_id)
        FROM public.participants p
        WHERE p.user_id = p_user_id AND p.role = 'host'
      ),
      'sessionsAsJoiner', (
        SELECT count(DISTINCT p.session_id)
        FROM public.participants p
        WHERE p.user_id = p_user_id AND p.role = 'joiner'
      ),
      'totalSessions', (
        SELECT count(DISTINCT p.session_id)
        FROM public.participants p
        WHERE p.user_id = p_user_id
      ),
      'practiceSessionsStarted', (
        SELECT count(*)
        FROM public.analytics_events
        WHERE event_name = 'practice_started'
          AND (
            user_id = p_user_id
            OR participant_id IN (
              SELECT id FROM public.participants WHERE user_id = p_user_id
            )
          )
      ),
      'firstSeenAt', (
        SELECT min(p.joined_at) FROM public.participants p WHERE p.user_id = p_user_id
      ),
      'lastActiveAt', (
        SELECT max(p.joined_at) FROM public.participants p WHERE p.user_id = p_user_id
      )
    ),
    'overtraining', public.compute_overtraining_load(p_user_id, 'UTC')
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_user_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_user_detail(uuid) TO authenticated;
