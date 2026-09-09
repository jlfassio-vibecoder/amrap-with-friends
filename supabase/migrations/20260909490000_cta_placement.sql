-- Which link converts, not just which page.
--
-- content_cta_clicked now carries a `cta` label -- an explicit data-cta where
-- one is set, otherwise the landmark the link sits in (nav, header, footer,
-- inline). Without a reader that column is just storage, and the question it
-- answers is the practical one: a hero button and a closing link pointing at
-- the same route were previously one number, so "this page converts" could
-- never become "this placement converts".
--
-- Ranked by clicks, and reported per source page, because the same label means
-- different things on different pages: the inline links in a guide are the
-- guide's argument, while inline links on the home page are mostly navigation.
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
      -- Rows written before the label shipped have no cta key; they are real
      -- clicks and are kept, named for what they are rather than dropped.
      coalesce(nullif(ae.props ->> 'cta', ''), 'unlabelled') AS cta,
      coalesce(ae.props ->> 'from_path', ae.route) AS from_path,
      ae.props ->> 'to_path' AS to_path,
      ae.anon_id
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
