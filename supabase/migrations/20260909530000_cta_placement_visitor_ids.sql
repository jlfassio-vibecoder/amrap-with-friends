-- Copilot review on PR #121: report_cta_placement counted the placeholder
-- anon ids as visitors.
--
-- '' and 'unknown' are sentinels, not people -- getOrCreateAnonId treats
-- 'unknown' as absent and mints a real id over it -- and five other reporting
-- queries already exclude both. Counting them here inflated `visitors` and so
-- deflated every rate derived from it, in the one panel meant to say which
-- placement is worth keeping.
--
-- Click rows are unaffected: a click with a null or placeholder id is still a
-- real click, and in the EEA a visitor who declined consent has no id at all.
-- Only the distinct-visitor count is filtered, so `clicks` stays complete and
-- `visitors` stays honest.
--
-- A separate migration rather than an edit to 20260909490000, which is already
-- recorded in the remote migration history.
CREATE OR REPLACE FUNCTION public.report_cta_placement(
  p_since timestamptz DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  cta text,
  from_path text,
  to_path text,
  clicks bigint,
  visitors bigint,
  signed_up bigint
)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  WITH clicks AS (
    SELECT
      coalesce(nullif(ae.props ->> 'cta', ''), 'unlabelled') AS cta,
      coalesce(ae.props ->> 'from_path', ae.route) AS from_path,
      ae.props ->> 'to_path' AS to_path,
      -- Normalised once, here, so every count below agrees on what an
      -- identifiable visitor is.
      CASE
        WHEN ae.anon_id IS NULL OR ae.anon_id = '' OR ae.anon_id = 'unknown' THEN NULL
        ELSE ae.anon_id
      END AS anon_id
    FROM public.analytics_events ae
    WHERE ae.event_name = 'content_cta_clicked'
      AND (p_since IS NULL OR ae.occurred_at >= p_since)
  ),
  signups AS (
    SELECT c.cta, c.from_path, c.to_path, count(DISTINCT link.user_id) AS signed_up
    FROM clicks c
    INNER JOIN public.analytics_identity_links link ON link.anon_id = c.anon_id
    WHERE c.anon_id IS NOT NULL
    GROUP BY c.cta, c.from_path, c.to_path
  ),
  per_cta AS (
    SELECT
      cta,
      from_path,
      to_path,
      count(*) AS clicks,
      count(DISTINCT anon_id) AS visitors
    FROM clicks
    GROUP BY cta, from_path, to_path
  )
  SELECT
    p.cta,
    p.from_path,
    coalesce(p.to_path, '—'),
    p.clicks,
    p.visitors,
    coalesce(s.signed_up, 0)
  FROM per_cta p
  LEFT JOIN signups s
    ON s.cta = p.cta
   AND s.from_path IS NOT DISTINCT FROM p.from_path
   AND s.to_path IS NOT DISTINCT FROM p.to_path
  ORDER BY p.clicks DESC, p.visitors DESC
  LIMIT LEAST(GREATEST(coalesce(p_limit, 50), 1), 200);
$$;

REVOKE EXECUTE ON FUNCTION public.report_cta_placement(timestamptz, int)
  FROM PUBLIC, anon, authenticated;
