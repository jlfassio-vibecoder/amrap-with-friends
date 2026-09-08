-- A time dimension for the coach dashboard.
--
-- Every reporting aggregate was lifetime-to-date, so a completion rate could
-- only ever be a single number with no way to tell whether it was improving.
-- Views cannot take arguments, so each aggregate becomes a function of
-- `p_since timestamptz` and the view stays behind as the all-time wrapper --
-- 20260826130000 advertises these views for the SQL editor and external BI,
-- and that keeps working unchanged.
--
-- NULL means all time. Each function windows on the column that makes the
-- metric a cohort rather than a coincidence, which is not the same column in
-- every case; where the choice is not obvious it is commented at the function.

CREATE OR REPLACE FUNCTION public.report_window_start(p_window text)
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT CASE lower(coalesce(p_window, 'all'))
    WHEN '7d' THEN now() - interval '7 days'
    WHEN '30d' THEN now() - interval '30 days'
    WHEN '90d' THEN now() - interval '90 days'
    ELSE NULL
  END;
$$;

-- ---------------------------------------------------------------- funnels

CREATE OR REPLACE FUNCTION public.report_claim_funnel(p_since timestamptz DEFAULT NULL)
RETURNS TABLE (
  prompts_shown bigint,
  claims_completed bigint,
  claims_conflicted bigint,
  completion_rate_pct numeric
)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT
    count(*) FILTER (WHERE event_name = 'claim_prompt_shown'),
    count(*) FILTER (WHERE event_name = 'claim_completed'),
    count(*) FILTER (WHERE event_name = 'claim_conflict'),
    round(
      100.0 * count(*) FILTER (WHERE event_name = 'claim_completed')
        / NULLIF(count(*) FILTER (WHERE event_name = 'claim_prompt_shown'), 0),
      2
    )
  FROM public.analytics_events
  WHERE event_name IN ('claim_prompt_shown', 'claim_completed', 'claim_conflict')
    AND (p_since IS NULL OR occurred_at >= p_since);
$$;

CREATE OR REPLACE FUNCTION public.report_intake_funnel(p_since timestamptz DEFAULT NULL)
RETURNS TABLE (submitted bigint, abandoned bigint, completion_rate_pct numeric)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT
    count(*) FILTER (WHERE event_name = 'intake_submitted'),
    count(*) FILTER (WHERE event_name = 'intake_abandoned'),
    round(
      100.0 * count(*) FILTER (WHERE event_name = 'intake_submitted') / NULLIF(
        count(*) FILTER (WHERE event_name = 'intake_submitted')
          + count(*) FILTER (WHERE event_name = 'intake_abandoned'),
        0
      ),
      2
    )
  FROM public.analytics_events
  WHERE event_name IN ('intake_submitted', 'intake_abandoned')
    AND (p_since IS NULL OR occurred_at >= p_since);
$$;

CREATE OR REPLACE FUNCTION public.report_rally_conversion(p_since timestamptz DEFAULT NULL)
RETURNS TABLE (links_copied bigint, deep_link_joins bigint, conversion_rate_pct numeric)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT
    count(*) FILTER (WHERE event_name = 'rally_link_copied'),
    count(*) FILTER (
      WHERE event_name IN ('mission_joined', 'session_joined')
        AND (props ->> 'deep_link')::boolean IS TRUE
    ),
    round(
      100.0 * count(*) FILTER (
        WHERE event_name IN ('mission_joined', 'session_joined')
          AND (props ->> 'deep_link')::boolean IS TRUE
      ) / NULLIF(count(*) FILTER (WHERE event_name = 'rally_link_copied'), 0),
      2
    )
  FROM public.analytics_events
  WHERE event_name IN ('rally_link_copied', 'mission_joined', 'session_joined')
    AND (p_since IS NULL OR occurred_at >= p_since);
$$;

CREATE OR REPLACE FUNCTION public.report_signup_funnel(p_since timestamptz DEFAULT NULL)
RETURNS TABLE (
  method text,
  attempts bigint,
  completions bigint,
  awaiting_confirmation bigint,
  failures bigint,
  completion_rate_pct numeric
)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT
    'password'::text,
    count(*) FILTER (WHERE event_name = 'auth_sign_up_attempted'),
    count(*) FILTER (
      WHERE event_name IN ('auth_sign_up_succeeded', 'auth_sign_up_needs_confirmation')
    ),
    count(*) FILTER (WHERE event_name = 'auth_sign_up_needs_confirmation'),
    count(*) FILTER (WHERE event_name = 'auth_sign_up_failed'),
    round(
      100.0 * count(*) FILTER (
        WHERE event_name IN ('auth_sign_up_succeeded', 'auth_sign_up_needs_confirmation')
      ) / NULLIF(count(*) FILTER (WHERE event_name = 'auth_sign_up_attempted'), 0),
      2
    )
  FROM public.analytics_events
  WHERE event_name IN (
      'auth_sign_up_attempted',
      'auth_sign_up_succeeded',
      'auth_sign_up_needs_confirmation',
      'auth_sign_up_failed'
    )
    AND (p_since IS NULL OR occurred_at >= p_since)
  UNION ALL
  SELECT
    'google'::text,
    count(*) FILTER (WHERE event_name = 'auth_google_started'),
    NULL::bigint,
    NULL::bigint,
    count(*) FILTER (WHERE event_name = 'auth_google_failed'),
    NULL::numeric
  FROM public.analytics_events
  WHERE event_name IN ('auth_google_started', 'auth_google_failed')
    AND (p_since IS NULL OR occurred_at >= p_since);
$$;

CREATE OR REPLACE FUNCTION public.report_auth_failure_reasons(p_since timestamptz DEFAULT NULL)
RETURNS TABLE (stage text, reason text, failure_count bigint, pct_of_failures numeric)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT
    CASE
      WHEN event_name = 'auth_sign_up_failed' THEN 'sign_up'
      WHEN event_name = 'auth_sign_in_failed' THEN 'sign_in'
      ELSE 'google'
    END::text,
    coalesce(props ->> 'reason', 'unknown')::text,
    count(*),
    round(100.0 * count(*) / NULLIF(sum(count(*)) OVER (), 0), 2)
  FROM public.analytics_events
  WHERE event_name IN ('auth_sign_up_failed', 'auth_sign_in_failed', 'auth_google_failed')
    AND (p_since IS NULL OR occurred_at >= p_since)
  GROUP BY 1, 2
  ORDER BY 3 DESC;
$$;

-- --------------------------------------------------------------- missions

-- Windowed on missions.created_at: a mission belongs to the period it was run
-- in, not the period its template was written in.
CREATE OR REPLACE FUNCTION public.report_template_performance(p_since timestamptz DEFAULT NULL)
RETURNS TABLE (
  template_id text,
  intensity_tier integer,
  duration_minutes integer,
  missions_created bigint,
  missions_completed bigint,
  completion_rate_pct numeric
)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT
    m.template_id,
    m.intensity_tier,
    m.duration_minutes,
    count(*),
    count(*) FILTER (WHERE m.state = 'finished'),
    round(100.0 * count(*) FILTER (WHERE m.state = 'finished') / NULLIF(count(*), 0), 2)
  FROM public.missions m
  WHERE m.template_id IS NOT NULL
    AND (p_since IS NULL OR m.created_at >= p_since)
  GROUP BY m.template_id, m.intensity_tier, m.duration_minutes
  ORDER BY count(*) DESC;
$$;

CREATE OR REPLACE FUNCTION public.report_mission_abandonment(p_since timestamptz DEFAULT NULL)
RETURNS TABLE (
  missions_finished bigint,
  missions_with_abandonment_event bigint,
  abandonment_rate_pct numeric
)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  WITH eligible_missions AS (
    SELECT id, state
    FROM public.missions
    WHERE state IN ('work', 'finished')
      AND (p_since IS NULL OR created_at >= p_since)
  ),
  abandoned_mission_ids AS (
    SELECT DISTINCT mission_id
    FROM public.analytics_events
    WHERE event_name IN ('mission_abandoned', 'session_abandoned')
  )
  SELECT
    count(*) FILTER (WHERE em.state = 'finished'),
    count(*) FILTER (WHERE em.id IN (SELECT mission_id FROM abandoned_mission_ids)),
    round(
      100.0 * count(*) FILTER (
        WHERE em.id IN (SELECT mission_id FROM abandoned_mission_ids)
      ) / NULLIF(count(*), 0),
      2
    )
  FROM eligible_missions em;
$$;

-- The cohort is windowed on participants.joined_at, but first_role is read
-- from a user's whole history: which role someone held the very first time
-- they appeared is a lifetime fact, and recomputing it inside a 7-day window
-- would relabel a long-standing host as a joiner the week they happen to join
-- someone else's mission.
CREATE OR REPLACE FUNCTION public.report_host_vs_joiner_retention(
  p_since timestamptz DEFAULT NULL
)
RETURNS TABLE (
  first_role text,
  user_count bigint,
  avg_missions_per_user numeric,
  avg_active_days_per_user numeric
)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  WITH first_role AS (
    SELECT DISTINCT ON (user_id) user_id, role AS first_role
    FROM public.participants
    WHERE user_id IS NOT NULL
    ORDER BY user_id, joined_at ASC
  ),
  per_user_stats AS (
    SELECT
      user_id,
      count(DISTINCT mission_id) AS mission_count,
      count(DISTINCT joined_at::date) AS active_days
    FROM public.participants
    WHERE user_id IS NOT NULL
      AND (p_since IS NULL OR joined_at >= p_since)
    GROUP BY user_id
  )
  SELECT
    fr.first_role,
    count(*),
    round(avg(pus.mission_count), 2),
    round(avg(pus.active_days), 2)
  FROM first_role fr
  JOIN per_user_stats pus ON pus.user_id = fr.user_id
  GROUP BY fr.first_role;
$$;

-- -------------------------------------------------------------- campaigns

-- Windowed on campaigns.created_at — a campaign is a cohort of the period it
-- was started in. Its occurrences are counted whenever they happened, because
-- a campaign started in week one of the window necessarily finishes outside it.
CREATE OR REPLACE FUNCTION public.report_campaign_funnel(p_since timestamptz DEFAULT NULL)
RETURNS TABLE (
  campaigns_created bigint,
  campaigns_in_flight bigint,
  campaigns_concluded bigint,
  campaigns_started bigint,
  campaigns_reached_halfway bigint,
  campaigns_finished bigint,
  finish_rate_pct numeric,
  occurrence_adherence_pct numeric
)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  WITH per_campaign AS (
    SELECT
      c.id,
      c.status,
      count(o.*) AS occurrence_count,
      count(o.*) FILTER (WHERE o.status = 'done') AS done_count,
      max(o.local_date) AS last_local_date
    FROM public.campaigns c
    LEFT JOIN public.campaign_occurrences o ON o.campaign_id = c.id
    WHERE p_since IS NULL OR c.created_at >= p_since
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
    count(*),
    count(*) FILTER (WHERE NOT concluded),
    count(*) FILTER (WHERE concluded),
    count(*) FILTER (WHERE concluded AND done_count >= 1),
    count(*) FILTER (
      WHERE concluded AND occurrence_count > 0 AND done_count * 2 >= occurrence_count
    ),
    count(*) FILTER (
      WHERE concluded AND occurrence_count > 0 AND done_count = occurrence_count
    ),
    round(
      100.0 * count(*) FILTER (
        WHERE concluded AND occurrence_count > 0 AND done_count = occurrence_count
      ) / NULLIF(count(*) FILTER (WHERE concluded), 0),
      2
    ),
    round(
      100.0 * sum(done_count) FILTER (WHERE concluded)
        / NULLIF(sum(occurrence_count) FILTER (WHERE concluded), 0),
      2
    )
  FROM classified;
$$;

CREATE OR REPLACE FUNCTION public.report_campaign_length_adherence(
  p_since timestamptz DEFAULT NULL
)
RETURNS TABLE (
  week_count integer,
  campaigns bigint,
  campaigns_finished bigint,
  occurrence_adherence_pct numeric
)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
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
    WHERE p_since IS NULL OR c.created_at >= p_since
    GROUP BY c.id, c.week_count, c.status
  )
  SELECT
    week_count,
    count(*),
    count(*) FILTER (WHERE occurrence_count > 0 AND done_count = occurrence_count),
    round(100.0 * sum(done_count) / NULLIF(sum(occurrence_count), 0), 2)
  FROM per_campaign
  WHERE status IN ('complete', 'abandoned')
     OR (last_local_date IS NOT NULL AND last_local_date < current_date)
  GROUP BY week_count
  ORDER BY week_count;
$$;

-- ------------------------------------------------------------ reliability

CREATE OR REPLACE FUNCTION public.report_audio_unlock_rate(p_since timestamptz DEFAULT NULL)
RETURNS TABLE (audio_context_state text, unlock_count bigint, pct_of_unlocks numeric)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT
    (props ->> 'state')::text,
    count(*),
    round(100.0 * count(*) / NULLIF(sum(count(*)) OVER (), 0), 2)
  FROM public.analytics_events
  WHERE event_name = 'audio_unlock_result'
    AND (p_since IS NULL OR occurred_at >= p_since)
  GROUP BY props ->> 'state'
  ORDER BY count(*) DESC;
$$;

CREATE OR REPLACE FUNCTION public.report_rpc_reliability(p_since timestamptz DEFAULT NULL)
RETURNS TABLE (
  rpc_name text,
  call_count bigint,
  error_count bigint,
  error_rate_pct numeric,
  p50_latency_ms numeric,
  p95_latency_ms numeric
)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT
    (props ->> 'rpc_name')::text,
    count(*),
    count(*) FILTER (WHERE (props ->> 'ok')::boolean IS FALSE),
    round(
      100.0 * count(*) FILTER (WHERE (props ->> 'ok')::boolean IS FALSE) / NULLIF(count(*), 0),
      2
    ),
    round(
      (percentile_cont(0.5) WITHIN GROUP (ORDER BY (props ->> 'duration_ms')::numeric))::numeric,
      1
    ),
    round(
      (percentile_cont(0.95) WITHIN GROUP (ORDER BY (props ->> 'duration_ms')::numeric))::numeric,
      1
    )
  FROM public.analytics_events
  WHERE event_name = 'rpc_call'
    AND (p_since IS NULL OR occurred_at >= p_since)
  GROUP BY props ->> 'rpc_name'
  ORDER BY count(*) DESC;
$$;

CREATE OR REPLACE FUNCTION public.report_realtime_reliability(p_since timestamptz DEFAULT NULL)
RETURNS TABLE (status text, event_count bigint, p50_subscribe_latency_ms numeric)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT
    (props ->> 'status')::text,
    count(*),
    round(
      (percentile_cont(0.5) WITHIN GROUP (
        ORDER BY (props ->> 'latency_ms')::numeric
      ) FILTER (WHERE props ->> 'latency_ms' IS NOT NULL))::numeric,
      1
    )
  FROM public.analytics_events
  WHERE event_name = 'realtime_status'
    AND (p_since IS NULL OR occurred_at >= p_since)
  GROUP BY props ->> 'status'
  ORDER BY count(*) DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.report_window_start(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.report_claim_funnel(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.report_intake_funnel(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.report_rally_conversion(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.report_signup_funnel(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.report_auth_failure_reasons(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.report_template_performance(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.report_mission_abandonment(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.report_host_vs_joiner_retention(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.report_campaign_funnel(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.report_campaign_length_adherence(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.report_audio_unlock_rate(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.report_rpc_reliability(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.report_realtime_reliability(timestamptz) FROM PUBLIC, anon, authenticated;

-- The views stay as the all-time wrappers, so anything reading them through
-- the SQL editor or an external BI connection is unaffected.
CREATE OR REPLACE VIEW public.v_claim_funnel AS SELECT * FROM public.report_claim_funnel(NULL);
CREATE OR REPLACE VIEW public.v_intake_funnel AS SELECT * FROM public.report_intake_funnel(NULL);
CREATE OR REPLACE VIEW public.v_rally_conversion AS
  SELECT * FROM public.report_rally_conversion(NULL);
CREATE OR REPLACE VIEW public.v_signup_funnel AS SELECT * FROM public.report_signup_funnel(NULL);
CREATE OR REPLACE VIEW public.v_auth_failure_reasons AS
  SELECT * FROM public.report_auth_failure_reasons(NULL);
CREATE OR REPLACE VIEW public.v_template_performance AS
  SELECT * FROM public.report_template_performance(NULL);
CREATE OR REPLACE VIEW public.v_mission_abandonment AS
  SELECT * FROM public.report_mission_abandonment(NULL);
CREATE OR REPLACE VIEW public.v_host_vs_joiner_retention AS
  SELECT * FROM public.report_host_vs_joiner_retention(NULL);
CREATE OR REPLACE VIEW public.v_campaign_funnel AS
  SELECT * FROM public.report_campaign_funnel(NULL);
CREATE OR REPLACE VIEW public.v_campaign_length_adherence AS
  SELECT * FROM public.report_campaign_length_adherence(NULL);
CREATE OR REPLACE VIEW public.v_audio_unlock_rate AS
  SELECT * FROM public.report_audio_unlock_rate(NULL);
CREATE OR REPLACE VIEW public.v_rpc_reliability AS
  SELECT * FROM public.report_rpc_reliability(NULL);
CREATE OR REPLACE VIEW public.v_realtime_reliability AS
  SELECT * FROM public.report_realtime_reliability(NULL);

REVOKE ALL ON public.v_claim_funnel FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_intake_funnel FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_rally_conversion FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_signup_funnel FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_auth_failure_reasons FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_template_performance FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_mission_abandonment FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_host_vs_joiner_retention FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_campaign_funnel FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_campaign_length_adherence FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_audio_unlock_rate FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_rpc_reliability FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_realtime_reliability FROM PUBLIC, anon, authenticated;

-- The zero-argument coach_dashboard is dropped, not left alongside this one:
-- adding a defaulted parameter creates an overload, and a bare
-- coach_dashboard() call would keep resolving to the old body forever. A
-- client that sends no argument still works, because p_window has a default.
DROP FUNCTION IF EXISTS public.coach_dashboard();

-- coach_dashboard takes the window. Default 'all' keeps every existing caller
-- (and an older deployed client that sends no argument) on exactly the numbers
-- it shows today; the client picks the window explicitly.
CREATE OR REPLACE FUNCTION public.coach_dashboard(p_window text DEFAULT 'all')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $function$
DECLARE
  v_since timestamptz;
  v_window text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_window := lower(coalesce(p_window, 'all'));
  IF v_window NOT IN ('7d', '30d', '90d', 'all') THEN
    RAISE EXCEPTION 'Unsupported window';
  END IF;
  v_since := public.report_window_start(v_window);

  RETURN jsonb_build_object(
    'ok', true,
    'window', v_window,
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
    'claimFunnel', (SELECT to_jsonb(v) FROM public.report_claim_funnel(v_since) v),
    'intakeFunnel', (SELECT to_jsonb(v) FROM public.report_intake_funnel(v_since) v),
    'rallyConversion', (SELECT to_jsonb(v) FROM public.report_rally_conversion(v_since) v),
    'missionAbandonment', (SELECT to_jsonb(v) FROM public.report_mission_abandonment(v_since) v),
    'signupFunnel', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.report_signup_funnel(v_since) v
    ),
    'authFailureReasons', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.report_auth_failure_reasons(v_since) v
    ),
    'campaignFunnel', (SELECT to_jsonb(v) FROM public.report_campaign_funnel(v_since) v),
    'campaignLengthAdherence', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb)
      FROM public.report_campaign_length_adherence(v_since) v
    ),
    'templatePerformance', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.report_template_performance(v_since) v
    ),
    'hostVsJoinerRetention', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb)
      FROM public.report_host_vs_joiner_retention(v_since) v
    ),
    'audioUnlockRate', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.report_audio_unlock_rate(v_since) v
    ),
    'rpcReliability', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.report_rpc_reliability(v_since) v
    ),
    'realtimeReliability', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.report_realtime_reliability(v_since) v
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.coach_dashboard(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_dashboard(text) TO authenticated;
