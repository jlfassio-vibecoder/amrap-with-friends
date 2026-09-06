-- Report training load in minutes, and measure the baseline against the history
-- that exists rather than an assumed four weeks.
--
-- Two problems with the overtraining payload, both of which reached athletes.
--
-- The card could only show load — minutes x intensity — which is a coach's
-- internal bookkeeping unit with no external referent. "190" is unactionable
-- even to a trainer, because an athlete never chooses load; they choose minutes
-- and intensity. The same windows now also return minutes so the card can speak
-- in the units the athlete controls.
--
-- Chronic weekly divided the 28-day total by a flat four weeks, so a nine-day-old
-- account had its typical week understated roughly threefold and every ratio
-- built on it inflated to match. It now divides by the weeks of history the
-- account could actually have. Account age is the right measure rather than
-- first-activity date: an established account that trained nothing for three
-- weeks genuinely is ramping from a standing start.
--
-- `observedDays` ships with the numbers so the client can say plainly that a
-- baseline is still forming instead of presenting a provisional ratio as fact.

CREATE OR REPLACE FUNCTION public.compute_overtraining_load(p_user_id uuid, p_timezone text DEFAULT 'UTC'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_tz text;
  v_local_today date;
  v_amrap_load_7d numeric;
  v_pa_load_7d numeric;
  v_acute_load_7d numeric;
  v_amrap_load_28d numeric;
  v_pa_load_28d numeric;
  v_chronic_weekly_load_28d numeric;
  v_amrap_minutes_7d numeric;
  v_pa_minutes_7d numeric;
  v_acute_minutes_7d numeric;
  v_amrap_minutes_28d numeric;
  v_pa_minutes_28d numeric;
  v_chronic_weekly_minutes_28d numeric;
  v_account_created timestamptz;
  v_observed_days int;
  v_observed_weeks numeric;
  v_consecutive_hard_days int;
  v_day_offset int;
  v_is_hard_day boolean;
BEGIN
  -- Copilot suggestion ignored: callers already validate timezone (hud_telemetry) or pass UTC (coach_user_detail), and reject null user ids before invoke — matches classification_quotas trust-caller pattern.
  v_tz := coalesce(nullif(btrim(coalesce(p_timezone, '')), ''), 'UTC');
  v_local_today := (now() AT TIME ZONE v_tz)::date;

  SELECT
    coalesce(sum(s.duration_minutes * coalesce(s.intensity_tier, 2)), 0),
    coalesce(sum(s.duration_minutes), 0)
  INTO v_amrap_load_7d, v_amrap_minutes_7d
  FROM public.participants p
  INNER JOIN public.missions s ON s.id = p.mission_id
  INNER JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
   AND psr.segment_index = s.segment_index
  WHERE p.user_id = p_user_id
    AND psr.score_breakdown IS NOT NULL
    AND psr.updated_at >= now() - interval '7 days';

  SELECT
    coalesce(sum(duration_minutes * intensity_tier), 0),
    coalesce(sum(duration_minutes), 0)
  INTO v_pa_load_7d, v_pa_minutes_7d
  FROM public.physical_activity_log
  WHERE user_id = p_user_id
    AND occurred_at >= now() - interval '7 days';

  v_acute_load_7d := v_amrap_load_7d + v_pa_load_7d;
  v_acute_minutes_7d := v_amrap_minutes_7d + v_pa_minutes_7d;

  SELECT
    coalesce(sum(s.duration_minutes * coalesce(s.intensity_tier, 2)), 0),
    coalesce(sum(s.duration_minutes), 0)
  INTO v_amrap_load_28d, v_amrap_minutes_28d
  FROM public.participants p
  INNER JOIN public.missions s ON s.id = p.mission_id
  INNER JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
   AND psr.segment_index = s.segment_index
  WHERE p.user_id = p_user_id
    AND psr.score_breakdown IS NOT NULL
    AND psr.updated_at >= now() - interval '28 days';

  SELECT
    coalesce(sum(duration_minutes * intensity_tier), 0),
    coalesce(sum(duration_minutes), 0)
  INTO v_pa_load_28d, v_pa_minutes_28d
  FROM public.physical_activity_log
  WHERE user_id = p_user_id
    AND occurred_at >= now() - interval '28 days';

  -- Divide by the weeks of history this account could actually have, not by a
  -- flat four. An account that is nine days old has nine days of data; dividing
  -- it by four weeks understates the athlete's typical week roughly threefold,
  -- which inflates every acute:chronic ratio built on top of it and is what
  -- made a 70-minute week read as high-risk overtraining.
  --
  -- Account age rather than first-activity date on purpose: an established
  -- account that trained nothing for three weeks really is ramping from a
  -- standing start, and should not have that excused.
  SELECT created_at INTO v_account_created FROM auth.users WHERE id = p_user_id;
  v_observed_days := least(
    28,
    greatest(1, floor(extract(epoch FROM now() - coalesce(v_account_created, now() - interval '28 days')) / 86400)::int + 1)
  );
  v_observed_weeks := greatest(v_observed_days / 7.0, 1.0 / 7.0);

  v_chronic_weekly_load_28d := (v_amrap_load_28d + v_pa_load_28d) / v_observed_weeks;
  v_chronic_weekly_minutes_28d := (v_amrap_minutes_28d + v_pa_minutes_28d) / v_observed_weeks;

  -- Consecutive local-calendar days (ending today) with any intensity-4+
  -- activity from either source. Loop bound of 14 is a safety cap well
  -- past the 5-day rest-day threshold the client-side evaluator uses.
  v_consecutive_hard_days := 0;
  FOR v_day_offset IN 0..13 LOOP
    SELECT
      EXISTS (
        SELECT 1
        FROM public.participants p
        INNER JOIN public.missions s ON s.id = p.mission_id
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
    'chronicWeeklyLoad28d', round(v_chronic_weekly_load_28d),
    'consecutiveHighIntensityDays', v_consecutive_hard_days,
    'acuteMinutes7d', round(v_acute_minutes_7d),
    'chronicWeeklyMinutes28d', round(v_chronic_weekly_minutes_28d),
    'observedDays', v_observed_days
  );
END;
$function$;
