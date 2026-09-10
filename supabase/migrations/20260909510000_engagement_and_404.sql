-- Read or bounced, and what is broken.

-- Depth per page. A pageview could not tell a two-second bounce from a full
-- read of a two-thousand-word guide, which is the whole input to "what should
-- we write more of".
--
-- A bounce is defined here as under ten seconds AND under a quarter of the
-- page. Either alone is a false positive: someone can read a short answer in
-- eight seconds and leave satisfied, and someone can scroll to the bottom
-- looking for a link without reading a word.
CREATE OR REPLACE FUNCTION public.report_content_engagement(
  p_since timestamptz DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  path text,
  sessions bigint,
  median_scroll_pct numeric,
  median_dwell_sec numeric,
  read_to_end bigint,
  bounced bigint,
  bounce_rate_pct numeric
)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  WITH engaged AS (
    SELECT
      coalesce(ae.props ->> 'path', ae.route) AS path,
      -- jsonb_typeof, not a bare cast: props is attacker-writable, and one
      -- malformed row must not take the report down.
      CASE
        WHEN jsonb_typeof(ae.props -> 'max_scroll_pct') = 'number'
          THEN (ae.props ->> 'max_scroll_pct')::numeric
      END AS scroll_pct,
      CASE
        WHEN jsonb_typeof(ae.props -> 'dwell_sec') = 'number'
          THEN (ae.props ->> 'dwell_sec')::numeric
      END AS dwell_sec
    FROM public.analytics_events ae
    WHERE ae.event_name = 'content_page_engaged'
      AND (p_since IS NULL OR ae.occurred_at >= p_since)
  )
  SELECT
    path,
    count(*),
    round(percentile_cont(0.5) WITHIN GROUP (ORDER BY scroll_pct)::numeric, 1),
    round(percentile_cont(0.5) WITHIN GROUP (ORDER BY dwell_sec)::numeric, 1),
    count(*) FILTER (WHERE scroll_pct >= 90),
    count(*) FILTER (WHERE dwell_sec < 10 AND scroll_pct < 25),
    round(
      100.0 * count(*) FILTER (WHERE dwell_sec < 10 AND scroll_pct < 25)
        / NULLIF(count(*), 0),
      2
    )
  FROM engaged
  WHERE path IS NOT NULL
    AND scroll_pct IS NOT NULL
    AND dwell_sec IS NOT NULL
  GROUP BY path
  ORDER BY count(*) DESC
  LIMIT LEAST(GREATEST(coalesce(p_limit, 50), 1), 200);
$$;

REVOKE EXECUTE ON FUNCTION public.report_content_engagement(timestamptz, int)
  FROM PUBLIC, anon, authenticated;

-- What is broken, and who is linking to it.
--
-- The edge middleware answers unknown paths with hand-built HTML carrying no
-- Astro layout, so nothing on that page reported and broken inbound links were
-- invisible. The referrer host separates our own stale link from someone
-- else's — one is a bug to fix, the other is a redirect to add.
CREATE OR REPLACE FUNCTION public.report_not_found(
  p_since timestamptz DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS TABLE (path text, referrer_host text, hits bigint)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT
    coalesce(ae.props ->> 'path', ae.route),
    coalesce(nullif(ae.props ->> 'referrer_host', ''), 'direct'),
    count(*)
  FROM public.analytics_events ae
  WHERE ae.event_name = 'content_404'
    AND (p_since IS NULL OR ae.occurred_at >= p_since)
  GROUP BY 1, 2
  ORDER BY count(*) DESC
  LIMIT LEAST(GREATEST(coalesce(p_limit, 50), 1), 200);
$$;

REVOKE EXECUTE ON FUNCTION public.report_not_found(timestamptz, int)
  FROM PUBLIC, anon, authenticated;
