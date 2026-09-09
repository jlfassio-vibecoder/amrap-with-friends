-- Where inside a mission people actually quit.
--
-- The abandonment beacon has carried `time_left_sec` and `round_count` since
-- it was written, and nothing has ever read either. v_mission_abandonment
-- reports one number -- what share of missions saw a beacon -- so a mission
-- people bail on in the first minute and one they quit with thirty seconds
-- left are indistinguishable, and the two call for opposite fixes.
--
-- Elapsed is expressed as a percentage of that mission's own clock, because
-- the product runs 3-25 minute caps and an absolute "quit at 4 minutes" means
-- something different at each one.

CREATE OR REPLACE FUNCTION public.report_mission_dropoff(p_since timestamptz DEFAULT NULL)
RETURNS TABLE (
  bucket_order int,
  elapsed_bucket text,
  abandons bigint,
  pct_of_abandons numeric,
  median_elapsed_pct numeric,
  median_rounds numeric
)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  WITH beacons AS (
    -- One row per participant per mission. visibilitychange and pagehide can
    -- both fire, and sendBeacon retries, so the raw events double-count; the
    -- first beacon is the moment they actually left.
    SELECT DISTINCT ON (ae.mission_id, ae.participant_id)
      ae.mission_id,
      ae.participant_id,
      ae.props,
      ae.occurred_at
    FROM public.analytics_events ae
    WHERE ae.event_name IN ('mission_abandoned', 'session_abandoned')
      AND ae.mission_id IS NOT NULL
      AND (p_since IS NULL OR ae.occurred_at >= p_since)
    ORDER BY ae.mission_id, ae.participant_id, ae.occurred_at ASC
  ),
  measured AS (
    SELECT
      -- jsonb_typeof rather than a cast: the beacon is client-written and a
      -- malformed props payload must not abort the whole report.
      (b.props ->> 'time_left_sec')::numeric AS time_left_sec,
      CASE
        WHEN jsonb_typeof(b.props -> 'round_count') = 'number'
          THEN (b.props ->> 'round_count')::numeric
      END AS round_count,
      (m.duration_minutes * 60)::numeric AS cap_sec
    FROM beacons b
    INNER JOIN public.missions m ON m.id = b.mission_id
    WHERE jsonb_typeof(b.props -> 'time_left_sec') = 'number'
      AND m.duration_minutes > 0
  ),
  scaled AS (
    SELECT
      -- Clamped: a paused or drifted clock can report a negative remainder or
      -- one larger than the cap, and neither should land outside 0-100%.
      least(100, greatest(0, 100.0 * (cap_sec - time_left_sec) / cap_sec)) AS elapsed_pct,
      round_count
    FROM measured
    WHERE time_left_sec IS NOT NULL
  ),
  bucketed AS (
    SELECT
      least(5, greatest(1, width_bucket(elapsed_pct, 0, 100, 5))) AS bucket_order,
      elapsed_pct,
      round_count
    FROM scaled
  )
  SELECT
    bucket_order::int,
    (CASE bucket_order
      WHEN 1 THEN 'First fifth (0-20%)'
      WHEN 2 THEN 'Second fifth (20-40%)'
      WHEN 3 THEN 'Middle (40-60%)'
      WHEN 4 THEN 'Fourth fifth (60-80%)'
      ELSE 'Final fifth (80-100%)'
    END)::text,
    count(*),
    round(100.0 * count(*) / NULLIF(sum(count(*)) OVER (), 0), 2),
    round(percentile_cont(0.5) WITHIN GROUP (ORDER BY elapsed_pct)::numeric, 1),
    round(
      (percentile_cont(0.5) WITHIN GROUP (ORDER BY round_count)
        FILTER (WHERE round_count IS NOT NULL))::numeric,
      1
    )
  FROM bucketed
  GROUP BY bucket_order
  ORDER BY bucket_order;
$$;

REVOKE EXECUTE ON FUNCTION public.report_mission_dropoff(timestamptz)
  FROM PUBLIC, anon, authenticated;
