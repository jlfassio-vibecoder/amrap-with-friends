-- Two reporting views were reading event names the client stopped emitting.
--
-- 20260901400000_mission_rename.sql renamed these views and their output
-- columns with ALTER VIEW ... RENAME, which moves names but never re-runs the
-- view body. The bodies still filtered on the pre-rename event-name string
-- literals ('session_joined', 'session_abandoned') while the client had moved
-- to 'mission_joined' / 'mission_abandoned' — so "Rally link" deep-link joins
-- and live-mission abandonment had both been reporting a hard zero.
--
-- analytics_events was never backfilled (event_name is data, not schema), so
-- both names are matched: rows written before the rename keep the old one.
-- Do not narrow these to the mission_* name alone — that trades one silent
-- zero for a silent truncation of every pre-rename row.

CREATE OR REPLACE VIEW public.v_rally_conversion AS
SELECT
  count(*) FILTER (WHERE event_name = 'rally_link_copied') AS links_copied,
  count(*) FILTER (
    WHERE event_name IN ('mission_joined', 'session_joined')
      AND (props ->> 'deep_link')::boolean IS TRUE
  ) AS deep_link_joins,
  round(
    100.0 * count(*) FILTER (
      WHERE event_name IN ('mission_joined', 'session_joined')
        AND (props ->> 'deep_link')::boolean IS TRUE
    ) / NULLIF(count(*) FILTER (WHERE event_name = 'rally_link_copied'), 0),
    2
  ) AS conversion_rate_pct
FROM public.analytics_events
WHERE event_name IN ('rally_link_copied', 'mission_joined', 'session_joined');

REVOKE ALL ON public.v_rally_conversion FROM PUBLIC, anon, authenticated;

-- Live-mission abandonment rate: missions that reached work/finished vs.
-- those with an abandonment beacon (sendBeacon on tab close/hide during
-- work). Row-safe against duplicate beacons for the same mission
-- (visibilitychange + pagehide can both fire) by pre-deduplicating mission
-- ids in a CTE rather than joining raw event rows.
CREATE OR REPLACE VIEW public.v_mission_abandonment AS
WITH eligible_missions AS (
  SELECT id, state
  FROM public.missions
  WHERE state IN ('work', 'finished')
),
abandoned_mission_ids AS (
  SELECT DISTINCT mission_id
  FROM public.analytics_events
  WHERE event_name IN ('mission_abandoned', 'session_abandoned')
)
SELECT
  count(*) FILTER (WHERE em.state = 'finished') AS missions_finished,
  count(*) FILTER (
    WHERE em.id IN (SELECT mission_id FROM abandoned_mission_ids)
  ) AS missions_with_abandonment_event,
  round(
    100.0 * count(*) FILTER (
      WHERE em.id IN (SELECT mission_id FROM abandoned_mission_ids)
    ) / NULLIF(count(*), 0),
    2
  ) AS abandonment_rate_pct
FROM eligible_missions em;

REVOKE ALL ON public.v_mission_abandonment FROM PUBLIC, anon, authenticated;
