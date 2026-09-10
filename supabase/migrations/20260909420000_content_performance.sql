-- Do the content pages actually do anything.
--
-- The Astro layer -- the timer page, the guides, the generated exercise and
-- workout pages, the sitemap that lists them all -- has been shipped and
-- indexed without a single measurement. Now that BaseLayout reports a
-- pageview and a click into the app, this is the payoff: per page, how many
-- people arrived, how many crossed into the product, and how many of those
-- ever signed up.
--
-- Ranked by crossings, not by views. A page with ten thousand readers who
-- never enter the app is an SEO result, not a product one, and this table
-- exists to tell those apart.
CREATE OR REPLACE FUNCTION public.report_content_performance(
  p_since timestamptz DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  path text,
  views bigint,
  entry_views bigint,
  visitors bigint,
  cta_clicks bigint,
  cta_rate_pct numeric,
  signed_up bigint
)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  WITH views AS (
    SELECT
      coalesce(ae.props ->> 'path', ae.route) AS path,
      ae.anon_id,
      (ae.props ->> 'entry')::boolean AS is_entry
    FROM public.analytics_events ae
    WHERE ae.event_name = 'content_page_viewed'
      AND (p_since IS NULL OR ae.occurred_at >= p_since)
  ),
  clicks AS (
    SELECT
      ae.props ->> 'from_path' AS path,
      ae.anon_id
    FROM public.analytics_events ae
    WHERE ae.event_name = 'content_cta_clicked'
      AND (p_since IS NULL OR ae.occurred_at >= p_since)
  ),
  per_path AS (
    SELECT
      v.path,
      count(*) AS views,
      count(*) FILTER (WHERE v.is_entry) AS entry_views,
      count(DISTINCT v.anon_id) AS visitors,
      -- Distinct visitors who crossed, not raw clicks: one person clicking
      -- twice is not two conversions.
      (
        SELECT count(DISTINCT c.anon_id) FROM clicks c WHERE c.path = v.path
      ) AS cta_clicks,
      (
        SELECT count(DISTINCT link.user_id)
        FROM public.analytics_identity_links link
        WHERE link.anon_id IN (
          SELECT v2.anon_id FROM views v2 WHERE v2.path = v.path AND v2.anon_id IS NOT NULL
        )
      ) AS signed_up
    FROM views v
    WHERE v.path IS NOT NULL
    GROUP BY v.path
  )
  SELECT
    path,
    views,
    entry_views,
    visitors,
    cta_clicks,
    round(100.0 * cta_clicks / NULLIF(visitors, 0), 2),
    signed_up
  FROM per_path
  ORDER BY cta_clicks DESC, views DESC
  LIMIT LEAST(GREATEST(coalesce(p_limit, 50), 1), 200);
$$;

REVOKE EXECUTE ON FUNCTION public.report_content_performance(timestamptz, int)
  FROM PUBLIC, anon, authenticated;
