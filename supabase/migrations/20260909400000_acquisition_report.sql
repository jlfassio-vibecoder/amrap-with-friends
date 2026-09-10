-- Which channels bring people who actually train.
--
-- Nothing in the app recorded a referrer or a campaign tag, so the entire SEO
-- and content investment -- the Astro pages, the sitemap, the generated
-- exercise and workout pages, the media manifest -- had no feedback loop at
-- all. first_touch_captured now records the arrival; this turns it into a
-- funnel.
--
-- The join runs browser -> account -> training through
-- analytics_identity_links, which is why nothing had to change in the auth
-- events: the stitch already existed and simply had no reader.
--
-- Ranked by athletes who completed a mission, not by browsers. A channel that
-- delivers a thousand bounces is worth less than one delivering ten people
-- who train, and sorting by volume is how a dashboard talks you into the
-- former.
CREATE OR REPLACE FUNCTION public.report_acquisition(p_since timestamptz DEFAULT NULL)
RETURNS TABLE (
  channel text,
  source text,
  campaign text,
  browsers bigint,
  signed_up bigint,
  signup_rate_pct numeric,
  trained bigint,
  completed bigint,
  completion_rate_pct numeric
)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  WITH first_touch AS (
    -- One row per browser: the earliest capture wins, matching the client,
    -- which only ever writes a first touch it has not already stored.
    SELECT DISTINCT ON (ae.anon_id)
      ae.anon_id,
      coalesce(ae.props ->> 'channel', 'unknown') AS channel,
      ae.props ->> 'source' AS source,
      ae.props ->> 'campaign' AS campaign
    FROM public.analytics_events ae
    WHERE ae.event_name = 'first_touch_captured'
      AND ae.anon_id IS NOT NULL
      AND ae.anon_id <> ''
      AND ae.anon_id <> 'unknown'
      AND (p_since IS NULL OR ae.occurred_at >= p_since)
    ORDER BY ae.anon_id, ae.occurred_at ASC
  ),
  converted AS (
    SELECT
      ft.channel,
      ft.source,
      ft.campaign,
      ft.anon_id,
      link.user_id
    FROM first_touch ft
    LEFT JOIN public.analytics_identity_links link ON link.anon_id = ft.anon_id
  ),
  outcomes AS (
    SELECT
      c.channel,
      c.source,
      c.campaign,
      c.anon_id,
      c.user_id,
      EXISTS (
        SELECT 1 FROM public.participants p
        WHERE c.user_id IS NOT NULL AND p.user_id = c.user_id
      ) AS trained,
      EXISTS (
        SELECT 1
        FROM public.participants p
        INNER JOIN public.missions m ON m.id = p.mission_id
        INNER JOIN public.participant_segment_results psr
          ON psr.participant_id = p.id
         AND psr.segment_index = m.segment_index
        WHERE c.user_id IS NOT NULL
          AND p.user_id = c.user_id
          AND psr.final_score IS NOT NULL
      ) AS completed
    FROM converted c
  )
  SELECT
    channel,
    coalesce(source, '—'),
    coalesce(campaign, '—'),
    count(DISTINCT anon_id),
    count(DISTINCT user_id),
    round(
      100.0 * count(DISTINCT user_id) / NULLIF(count(DISTINCT anon_id), 0),
      2
    ),
    count(DISTINCT user_id) FILTER (WHERE trained),
    count(DISTINCT user_id) FILTER (WHERE completed),
    round(
      100.0 * count(DISTINCT user_id) FILTER (WHERE completed)
        / NULLIF(count(DISTINCT anon_id), 0),
      2
    )
  FROM outcomes
  GROUP BY channel, coalesce(source, '—'), coalesce(campaign, '—')
  ORDER BY count(DISTINCT user_id) FILTER (WHERE completed) DESC, count(DISTINCT anon_id) DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.report_acquisition(timestamptz)
  FROM PUBLIC, anon, authenticated;
