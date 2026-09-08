-- Two funnels the product was fully instrumented for but never reported on:
-- sign-up and campaigns. The auth_* and campaign events have been written to
-- analytics_events since Phase 0; nothing read them, so "Where commitment
-- dies" covered claim, intake and the rally link while the two places most
-- likely to lose a user — the sign-up form and week three of a campaign —
-- were invisible.

-- Sign-up, one row per method. The two methods are not symmetrically
-- observable and the view says so rather than papering over it:
--
--   password — the whole funnel happens in-page. An attempt resolves to
--     exactly one of succeeded / needs_confirmation / failed, so `completions`
--     (succeeded + needs_confirmation, i.e. "got through the form") and the
--     rate are real numbers.
--   google  — auth_google_started fires, then the browser leaves for Google
--     and comes back as auth_signed_in, which carries no memory of the
--     attempt it belongs to. Only the pre-redirect error is observable, so
--     completions and the rate are NULL. A zero there would read as "nobody
--     completes Google sign-up", which is the opposite of what we know.
CREATE OR REPLACE VIEW public.v_signup_funnel AS
SELECT
  'password' AS method,
  count(*) FILTER (WHERE event_name = 'auth_sign_up_attempted') AS attempts,
  count(*) FILTER (
    WHERE event_name IN ('auth_sign_up_succeeded', 'auth_sign_up_needs_confirmation')
  ) AS completions,
  count(*) FILTER (
    WHERE event_name = 'auth_sign_up_needs_confirmation'
  ) AS awaiting_confirmation,
  count(*) FILTER (WHERE event_name = 'auth_sign_up_failed') AS failures,
  round(
    100.0 * count(*) FILTER (
      WHERE event_name IN ('auth_sign_up_succeeded', 'auth_sign_up_needs_confirmation')
    ) / NULLIF(count(*) FILTER (WHERE event_name = 'auth_sign_up_attempted'), 0),
    2
  ) AS completion_rate_pct
FROM public.analytics_events
WHERE event_name IN (
  'auth_sign_up_attempted',
  'auth_sign_up_succeeded',
  'auth_sign_up_needs_confirmation',
  'auth_sign_up_failed'
)
UNION ALL
SELECT
  'google' AS method,
  count(*) FILTER (WHERE event_name = 'auth_google_started') AS attempts,
  NULL::bigint AS completions,
  NULL::bigint AS awaiting_confirmation,
  count(*) FILTER (WHERE event_name = 'auth_google_failed') AS failures,
  NULL::numeric AS completion_rate_pct
FROM public.analytics_events
WHERE event_name IN ('auth_google_started', 'auth_google_failed');

REVOKE ALL ON public.v_signup_funnel FROM PUBLIC, anon, authenticated;

-- Why sign-ups fail. 'duplicate' is a returning user who should have been
-- sent to sign-in and is a copy problem; anything else is a real defect or a
-- validation message worth rewriting. Sign-in failures are included as their
-- own method because a password sign-up that later fails at sign-in is the
-- same lost user.
CREATE OR REPLACE VIEW public.v_auth_failure_reasons AS
SELECT
  CASE
    WHEN event_name = 'auth_sign_up_failed' THEN 'sign_up'
    WHEN event_name = 'auth_sign_in_failed' THEN 'sign_in'
    ELSE 'google'
  END AS stage,
  coalesce(props ->> 'reason', 'unknown') AS reason,
  count(*) AS failure_count,
  round(100.0 * count(*) / NULLIF(sum(count(*)) OVER (), 0), 2) AS pct_of_failures
FROM public.analytics_events
WHERE event_name IN ('auth_sign_up_failed', 'auth_sign_in_failed', 'auth_google_failed')
GROUP BY 1, 2
ORDER BY failure_count DESC;

REVOKE ALL ON public.v_auth_failure_reasons FROM PUBLIC, anon, authenticated;

-- Campaign follow-through, read from campaign_occurrences rather than from a
-- campaign_created event: the tables are the record of what actually happened
-- and cannot drift from an event name.
--
-- Two decisions worth stating:
--
--   1. The funnel counts only *concluded* campaigns — status complete or
--      abandoned, or a last scheduled date already in the past. A campaign in
--      week two of eight has not failed to finish, and including it would
--      make the finish rate a function of how many campaigns started
--      recently. In-flight campaigns are reported separately.
--   2. Progress is measured in occurrences with status 'done', not
--      campaigns.status = 'complete'. The scheduler marks a campaign complete
--      once nothing is left to run, and 'skipped' counts as resolved — so
--      status alone would score a campaign nobody trained as finished.
CREATE OR REPLACE VIEW public.v_campaign_funnel AS
WITH per_campaign AS (
  SELECT
    c.id,
    c.status,
    count(o.*) AS occurrence_count,
    count(o.*) FILTER (WHERE o.status = 'done') AS done_count,
    max(o.local_date) AS last_local_date
  FROM public.campaigns c
  LEFT JOIN public.campaign_occurrences o ON o.campaign_id = c.id
  GROUP BY c.id, c.status
),
classified AS (
  SELECT
    *,
    (
      status IN ('complete', 'abandoned')
      OR (last_local_date IS NOT NULL AND last_local_date < current_date)
    ) AS concluded
  FROM per_campaign
)
SELECT
  count(*) AS campaigns_created,
  count(*) FILTER (WHERE NOT concluded) AS campaigns_in_flight,
  count(*) FILTER (WHERE concluded) AS campaigns_concluded,
  count(*) FILTER (WHERE concluded AND done_count >= 1) AS campaigns_started,
  count(*) FILTER (
    WHERE concluded AND occurrence_count > 0 AND done_count * 2 >= occurrence_count
  ) AS campaigns_reached_halfway,
  count(*) FILTER (
    WHERE concluded AND occurrence_count > 0 AND done_count = occurrence_count
  ) AS campaigns_finished,
  round(
    100.0 * count(*) FILTER (
      WHERE concluded AND occurrence_count > 0 AND done_count = occurrence_count
    ) / NULLIF(count(*) FILTER (WHERE concluded), 0),
    2
  ) AS finish_rate_pct,
  round(
    100.0 * sum(done_count) FILTER (WHERE concluded)
      / NULLIF(sum(occurrence_count) FILTER (WHERE concluded), 0),
    2
  ) AS occurrence_adherence_pct
FROM classified;

REVOKE ALL ON public.v_campaign_funnel FROM PUBLIC, anon, authenticated;

-- Does campaign length predict follow-through? week_count is constrained to
-- 2/4/6/8/12, so this is a five-row table, and it is the input to "should we
-- keep offering 12 weeks".
CREATE OR REPLACE VIEW public.v_campaign_length_adherence AS
WITH per_campaign AS (
  SELECT
    c.id,
    c.week_count,
    c.status,
    count(o.*) AS occurrence_count,
    count(o.*) FILTER (WHERE o.status = 'done') AS done_count,
    max(o.local_date) AS last_local_date
  FROM public.campaigns c
  LEFT JOIN public.campaign_occurrences o ON o.campaign_id = c.id
  GROUP BY c.id, c.week_count, c.status
)
SELECT
  week_count,
  count(*) AS campaigns,
  count(*) FILTER (
    WHERE occurrence_count > 0 AND done_count = occurrence_count
  ) AS campaigns_finished,
  round(
    100.0 * sum(done_count) / NULLIF(sum(occurrence_count), 0),
    2
  ) AS occurrence_adherence_pct
FROM per_campaign
WHERE status IN ('complete', 'abandoned')
   OR (last_local_date IS NOT NULL AND last_local_date < current_date)
GROUP BY week_count
ORDER BY week_count;

REVOKE ALL ON public.v_campaign_length_adherence FROM PUBLIC, anon, authenticated;

-- coach_dashboard, rebuilt from 20260903170000 with the four views added.
CREATE OR REPLACE FUNCTION public.coach_dashboard()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'topStrip', jsonb_build_object(
      'missionsCreated7d', (
        SELECT count(*) FROM public.missions WHERE created_at >= now() - interval '7 days'
      ),
      'missionsCreated30d', (
        SELECT count(*) FROM public.missions WHERE created_at >= now() - interval '30 days'
      ),
      'missionsFinished7d', (
        SELECT count(*) FROM public.missions
        WHERE state = 'finished' AND created_at >= now() - interval '7 days'
      ),
      'missionsFinished30d', (
        SELECT count(*) FROM public.missions
        WHERE state = 'finished' AND created_at >= now() - interval '30 days'
      ),
      'guestBrowsers7d', (
        SELECT count(DISTINCT anon_id)
        FROM public.analytics_events
        WHERE user_id IS NULL
          AND occurred_at >= now() - interval '7 days'
          AND anon_id IS NOT NULL
          AND anon_id <> ''
          AND anon_id <> 'unknown'
      ),
      'uniqueAnonIds', (
        SELECT count(DISTINCT anon_id) FROM public.analytics_events WHERE anon_id IS NOT NULL
      ),
      'registeredUsers', (SELECT count(*) FROM public.athlete_profiles),
      'practiceMissionsStarted', (
        SELECT count(*) FROM public.analytics_events WHERE event_name = 'practice_started'
      ),
      'liveMissionsCreated', (
        SELECT count(*) FROM public.analytics_events WHERE event_name = 'mission_created'
      )
    ),
    'claimFunnel', (SELECT to_jsonb(v) FROM public.v_claim_funnel v),
    'intakeFunnel', (SELECT to_jsonb(v) FROM public.v_intake_funnel v),
    'rallyConversion', (SELECT to_jsonb(v) FROM public.v_rally_conversion v),
    'missionAbandonment', (SELECT to_jsonb(v) FROM public.v_mission_abandonment v),
    'signupFunnel', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.v_signup_funnel v
    ),
    'authFailureReasons', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.v_auth_failure_reasons v
    ),
    'campaignFunnel', (SELECT to_jsonb(v) FROM public.v_campaign_funnel v),
    'campaignLengthAdherence', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.v_campaign_length_adherence v
    ),
    'templatePerformance', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.v_template_performance v
    ),
    'hostVsJoinerRetention', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.v_host_vs_joiner_retention v
    ),
    'audioUnlockRate', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.v_audio_unlock_rate v
    ),
    'rpcReliability', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.v_rpc_reliability v
    ),
    'realtimeReliability', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.v_realtime_reliability v
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.coach_dashboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_dashboard() TO authenticated;
