-- Copilot review on PR #118: one unsafe cast and two correlated-subquery
-- shapes in the reports added by 20260909380000 and 20260909420000.
--
-- A separate migration rather than an edit to those files: both versions are
-- already recorded in the remote migration history, so editing them would
-- change what the repo says ran without changing what ran, and db push would
-- never replay them.

-- 1. (props ->> 'entry')::boolean could abort the entire report.
--
-- analytics_events grants INSERT to anon with WITH CHECK (true), so props is
-- attacker-writable: a single row carrying "entry": "banana" would make the
-- cast throw and take the content report down for every coach, permanently,
-- from an unauthenticated request. jsonb_typeof turns a malformed value into
-- NULL instead -- the same guard report_mission_dropoff already uses on
-- time_left_sec, which should have been applied here too.
--
-- 2. cta_clicks and signed_up were correlated subqueries evaluated per path,
-- one of them re-scanning `views` from inside an aggregate. Both are now
-- pre-aggregated once and joined, so the report stays linear in its input as
-- content traffic grows.
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
      CASE
        WHEN jsonb_typeof(ae.props -> 'entry') = 'boolean'
          THEN (ae.props ->> 'entry')::boolean
      END AS is_entry
    FROM public.analytics_events ae
    WHERE ae.event_name = 'content_page_viewed'
      AND (p_since IS NULL OR ae.occurred_at >= p_since)
  ),
  clicks_per_path AS (
    -- Distinct visitors who crossed, not raw clicks: one person clicking
    -- twice is not two conversions.
    SELECT
      ae.props ->> 'from_path' AS path,
      count(DISTINCT ae.anon_id) AS cta_clicks
    FROM public.analytics_events ae
    WHERE ae.event_name = 'content_cta_clicked'
      AND (p_since IS NULL OR ae.occurred_at >= p_since)
    GROUP BY ae.props ->> 'from_path'
  ),
  signups_per_path AS (
    SELECT v.path, count(DISTINCT link.user_id) AS signed_up
    FROM views v
    INNER JOIN public.analytics_identity_links link ON link.anon_id = v.anon_id
    WHERE v.anon_id IS NOT NULL
    GROUP BY v.path
  ),
  per_path AS (
    SELECT
      v.path,
      count(*) AS views,
      count(*) FILTER (WHERE v.is_entry) AS entry_views,
      count(DISTINCT v.anon_id) AS visitors
    FROM views v
    WHERE v.path IS NOT NULL
    GROUP BY v.path
  )
  SELECT
    pp.path,
    pp.views,
    pp.entry_views,
    pp.visitors,
    coalesce(cp.cta_clicks, 0),
    round(100.0 * coalesce(cp.cta_clicks, 0) / NULLIF(pp.visitors, 0), 2),
    coalesce(sp.signed_up, 0)
  FROM per_path pp
  LEFT JOIN clicks_per_path cp ON cp.path = pp.path
  LEFT JOIN signups_per_path sp ON sp.path = pp.path
  ORDER BY coalesce(cp.cta_clicks, 0) DESC, pp.views DESC
  LIMIT LEAST(GREATEST(coalesce(p_limit, 50), 1), 200);
$$;

REVOKE EXECUTE ON FUNCTION public.report_content_performance(timestamptz, int)
  FROM PUBLIC, anon, authenticated;

-- 3. group_size was a COUNT(*) over participants evaluated once per
-- participant row. Counting each mission once and joining is the same number
-- with one pass instead of one scan per row.
CREATE OR REPLACE FUNCTION public.report_social_lift(p_since timestamptz DEFAULT NULL)
RETURNS TABLE (
  cohort text,
  participations bigint,
  athletes bigint,
  completed bigint,
  completion_rate_pct numeric,
  return_eligible bigint,
  returned_within_14d bigint,
  return_rate_pct numeric,
  avg_group_size numeric
)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  WITH mission_sizes AS (
    SELECT mission_id, count(*) AS group_size
    FROM public.participants
    GROUP BY mission_id
  ),
  sized AS (
    SELECT
      p.id,
      p.user_id,
      p.mission_id,
      p.joined_at,
      m.segment_index,
      ms.group_size
    FROM public.participants p
    INNER JOIN public.missions m ON m.id = p.mission_id
    INNER JOIN mission_sizes ms ON ms.mission_id = p.mission_id
    WHERE p_since IS NULL OR p.joined_at >= p_since
  ),
  scored AS (
    SELECT
      s.*,
      CASE WHEN s.group_size > 1 THEN 'social' ELSE 'solo' END AS cohort,
      (psr.final_score IS NOT NULL) AS completed,
      (s.joined_at <= now() - interval '14 days') AS return_eligible,
      EXISTS (
        SELECT 1
        FROM public.participants later
        WHERE later.user_id = s.user_id
          AND s.user_id IS NOT NULL
          AND later.joined_at > s.joined_at
          AND later.joined_at <= s.joined_at + interval '14 days'
      ) AS returned
    FROM sized s
    LEFT JOIN public.participant_segment_results psr
      ON psr.participant_id = s.id
     AND psr.segment_index = s.segment_index
  )
  SELECT
    cohort,
    count(*),
    count(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL),
    count(*) FILTER (WHERE completed),
    round(100.0 * count(*) FILTER (WHERE completed) / NULLIF(count(*), 0), 2),
    count(*) FILTER (WHERE return_eligible AND user_id IS NOT NULL),
    count(*) FILTER (WHERE return_eligible AND returned),
    round(
      100.0 * count(*) FILTER (WHERE return_eligible AND returned)
        / NULLIF(count(*) FILTER (WHERE return_eligible AND user_id IS NOT NULL), 0),
      2
    ),
    round(avg(group_size), 2)
  FROM scored
  GROUP BY cohort
  ORDER BY cohort;
$$;

REVOKE EXECUTE ON FUNCTION public.report_social_lift(timestamptz)
  FROM PUBLIC, anon, authenticated;
