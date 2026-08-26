-- Phase 4: reporting views over analytics_events + core tables.
--
-- These are read-only aggregates for internal reporting (Supabase SQL
-- editor, or an external BI tool connected with the service role). None of
-- them are exposed to the client: no anon/authenticated grants, matching
-- how analytics_events itself is write-only from the client's perspective.

-- RPC reliability: call volume, error rate, and latency percentiles per RPC.
CREATE OR REPLACE VIEW public.v_rpc_reliability AS
SELECT
  props ->> 'rpc_name' AS rpc_name,
  count(*) AS call_count,
  count(*) FILTER (WHERE (props ->> 'ok')::boolean IS FALSE) AS error_count,
  round(
    100.0 * count(*) FILTER (WHERE (props ->> 'ok')::boolean IS FALSE)
      / NULLIF(count(*), 0),
    2
  ) AS error_rate_pct,
  round(
    (percentile_cont(0.5) WITHIN GROUP (ORDER BY (props ->> 'duration_ms')::numeric))::numeric,
    1
  ) AS p50_latency_ms,
  round(
    (percentile_cont(0.95) WITHIN GROUP (ORDER BY (props ->> 'duration_ms')::numeric))::numeric,
    1
  ) AS p95_latency_ms
FROM public.analytics_events
WHERE event_name = 'rpc_call'
GROUP BY props ->> 'rpc_name'
ORDER BY call_count DESC;

REVOKE ALL ON public.v_rpc_reliability FROM PUBLIC, anon, authenticated;

-- Realtime channel health: status transition volume and subscribe latency.
CREATE OR REPLACE VIEW public.v_realtime_reliability AS
SELECT
  props ->> 'status' AS status,
  count(*) AS event_count,
  round(
    (percentile_cont(0.5) WITHIN GROUP (
      ORDER BY (props ->> 'latency_ms')::numeric
    ) FILTER (WHERE props ->> 'latency_ms' IS NOT NULL))::numeric,
    1
  ) AS p50_subscribe_latency_ms
FROM public.analytics_events
WHERE event_name = 'realtime_status'
GROUP BY props ->> 'status'
ORDER BY event_count DESC;

REVOKE ALL ON public.v_realtime_reliability FROM PUBLIC, anon, authenticated;

-- Audio unlock success rate (AudioContext 'running' vs 'suspended'/blocked).
CREATE OR REPLACE VIEW public.v_audio_unlock_rate AS
SELECT
  props ->> 'state' AS audio_context_state,
  count(*) AS unlock_count,
  round(100.0 * count(*) / NULLIF(sum(count(*)) OVER (), 0), 2) AS pct_of_unlocks
FROM public.analytics_events
WHERE event_name = 'audio_unlock_result'
GROUP BY props ->> 'state'
ORDER BY unlock_count DESC;

REVOKE ALL ON public.v_audio_unlock_rate FROM PUBLIC, anon, authenticated;

-- Guest-to-account claim funnel.
CREATE OR REPLACE VIEW public.v_claim_funnel AS
SELECT
  count(*) FILTER (WHERE event_name = 'claim_prompt_shown') AS prompts_shown,
  count(*) FILTER (WHERE event_name = 'claim_completed') AS claims_completed,
  count(*) FILTER (WHERE event_name = 'claim_conflict') AS claims_conflicted,
  round(
    100.0 * count(*) FILTER (WHERE event_name = 'claim_completed')
      / NULLIF(count(*) FILTER (WHERE event_name = 'claim_prompt_shown'), 0),
    2
  ) AS completion_rate_pct
FROM public.analytics_events
WHERE event_name IN ('claim_prompt_shown', 'claim_completed', 'claim_conflict');

REVOKE ALL ON public.v_claim_funnel FROM PUBLIC, anon, authenticated;

-- Rally-link virality: copies vs. deep-link joins they produced.
CREATE OR REPLACE VIEW public.v_rally_conversion AS
SELECT
  count(*) FILTER (WHERE event_name = 'rally_link_copied') AS links_copied,
  count(*) FILTER (
    WHERE event_name = 'session_joined' AND (props ->> 'deep_link')::boolean IS TRUE
  ) AS deep_link_joins,
  round(
    100.0 * count(*) FILTER (
      WHERE event_name = 'session_joined' AND (props ->> 'deep_link')::boolean IS TRUE
    ) / NULLIF(count(*) FILTER (WHERE event_name = 'rally_link_copied'), 0),
    2
  ) AS conversion_rate_pct
FROM public.analytics_events
WHERE event_name IN ('rally_link_copied', 'session_joined');

REVOKE ALL ON public.v_rally_conversion FROM PUBLIC, anon, authenticated;

-- Intake dossier completion vs. abandonment.
CREATE OR REPLACE VIEW public.v_intake_funnel AS
SELECT
  count(*) FILTER (WHERE event_name = 'intake_submitted') AS submitted,
  count(*) FILTER (WHERE event_name = 'intake_abandoned') AS abandoned,
  round(
    100.0 * count(*) FILTER (WHERE event_name = 'intake_submitted') / NULLIF(
      count(*) FILTER (WHERE event_name = 'intake_submitted')
        + count(*) FILTER (WHERE event_name = 'intake_abandoned'),
      0
    ),
    2
  ) AS completion_rate_pct
FROM public.analytics_events
WHERE event_name IN ('intake_submitted', 'intake_abandoned');

REVOKE ALL ON public.v_intake_funnel FROM PUBLIC, anon, authenticated;

-- Template/category performance: selection volume and completion rate.
CREATE OR REPLACE VIEW public.v_template_performance AS
SELECT
  s.template_id,
  s.intensity_tier,
  s.duration_minutes,
  count(*) AS sessions_created,
  count(*) FILTER (WHERE s.state = 'finished') AS sessions_completed,
  round(
    100.0 * count(*) FILTER (WHERE s.state = 'finished') / NULLIF(count(*), 0),
    2
  ) AS completion_rate_pct
FROM public.sessions s
WHERE s.template_id IS NOT NULL
GROUP BY s.template_id, s.intensity_tier, s.duration_minutes
ORDER BY sessions_created DESC;

REVOKE ALL ON public.v_template_performance FROM PUBLIC, anon, authenticated;

-- Live-session abandonment rate: sessions that reached work/finished vs.
-- those with a session_abandoned beacon (sendBeacon on tab close/hide
-- during work). Row-safe against duplicate abandonment beacons for the
-- same session (visibilitychange + pagehide can both fire) by pre-
-- deduplicating session ids in a CTE rather than joining raw event rows.
CREATE OR REPLACE VIEW public.v_session_abandonment AS
WITH eligible_sessions AS (
  SELECT id, state
  FROM public.sessions
  WHERE state IN ('work', 'finished')
),
abandoned_session_ids AS (
  SELECT DISTINCT session_id
  FROM public.analytics_events
  WHERE event_name = 'session_abandoned'
)
SELECT
  count(*) FILTER (WHERE es.state = 'finished') AS sessions_finished,
  count(*) FILTER (
    WHERE es.id IN (SELECT session_id FROM abandoned_session_ids)
  ) AS sessions_with_abandonment_event,
  round(
    100.0 * count(*) FILTER (
      WHERE es.id IN (SELECT session_id FROM abandoned_session_ids)
    ) / NULLIF(count(*), 0),
    2
  ) AS abandonment_rate_pct
FROM eligible_sessions es;

REVOKE ALL ON public.v_session_abandonment FROM PUBLIC, anon, authenticated;

-- Host vs. joiner retention: classify each registered user by the role
-- (host/joiner) they held the first time they ever appeared in
-- participants, then compare session volume and active-day counts between
-- the two cohorts. Guests (participants.user_id IS NULL) are excluded —
-- there is no stable identity to cohort them by until they claim.
CREATE OR REPLACE VIEW public.v_host_vs_joiner_retention AS
WITH first_role AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    role AS first_role
  FROM public.participants
  WHERE user_id IS NOT NULL
  ORDER BY user_id, joined_at ASC
),
per_user_stats AS (
  SELECT
    user_id,
    count(DISTINCT session_id) AS session_count,
    count(DISTINCT joined_at::date) AS active_days
  FROM public.participants
  WHERE user_id IS NOT NULL
  GROUP BY user_id
)
SELECT
  fr.first_role,
  count(*) AS user_count,
  round(avg(pus.session_count), 2) AS avg_sessions_per_user,
  round(avg(pus.active_days), 2) AS avg_active_days_per_user
FROM first_role fr
JOIN per_user_stats pus ON pus.user_id = fr.user_id
GROUP BY fr.first_role;

REVOKE ALL ON public.v_host_vs_joiner_retention FROM PUBLIC, anon, authenticated;
