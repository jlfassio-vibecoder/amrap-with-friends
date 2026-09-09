-- Add today's mission to the tool-conversion cohorts.
--
-- FeaturedWodCard on the static home page already emitted featured_wod_viewed,
-- featured_wod_joined and featured_wod_calendar_saved -- it is shared with the
-- SPA -- and nothing read them, so the strongest path from the content layer
-- into the product was missing from the comparison. Joining today's mission is
-- a real workout, actually happening, one click away.
--
-- Saving the calendar invite counts as acting alongside joining: it is a
-- commitment to a specific workout at a specific time, which is the intent
-- being measured, even though the join itself happens later.
--
-- A separate migration rather than an edit to 20260909460000, which is already
-- recorded in the remote migration history. coach_dashboard already calls
-- report_tool_conversion, so replacing the function is the whole change.

CREATE OR REPLACE FUNCTION public.report_tool_conversion(p_since timestamptz DEFAULT NULL)
RETURNS TABLE (
  cohort_order int,
  cohort text,
  browsers bigint,
  cta_clicks bigint,
  signed_up bigint,
  signup_rate_pct numeric,
  trained bigint,
  completed_mission bigint,
  completed_rate_pct numeric
)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  WITH scoped AS (
    SELECT ae.anon_id, ae.event_name
    FROM public.analytics_events ae
    WHERE ae.anon_id IS NOT NULL
      AND ae.anon_id <> ''
      AND ae.anon_id <> 'unknown'
      AND ae.event_name IN (
        'content_page_viewed',
        'content_cta_clicked',
        'free_timer_started',
        'free_timer_completed',
        'free_timer_cta_clicked',
        'pacing_calculator_scored',
        'pacing_calculator_cta_clicked',
        'featured_wod_viewed',
        'featured_wod_joined',
        'featured_wod_calendar_saved'
      )
      AND (p_since IS NULL OR ae.occurred_at >= p_since)
  ),
  per_browser AS (
    SELECT
      anon_id,
      bool_or(event_name = 'content_page_viewed') AS read_a_page,
      bool_or(event_name = 'free_timer_started') AS timer_started,
      bool_or(event_name = 'free_timer_completed') AS timer_completed,
      bool_or(event_name = 'pacing_calculator_scored') AS pacing_scored,
      bool_or(event_name = 'featured_wod_viewed') AS featured_viewed,
      bool_or(
        event_name IN ('featured_wod_joined', 'featured_wod_calendar_saved')
      ) AS featured_acted,
      count(*) FILTER (
        WHERE event_name IN (
          'content_cta_clicked',
          'free_timer_cta_clicked',
          'pacing_calculator_cta_clicked'
        )
      ) AS cta_clicks
    FROM scoped
    GROUP BY anon_id
  ),
  outcomes AS (
    SELECT
      b.*,
      link.user_id,
      -- Same definitions the rest of the dashboard uses: trained means a
      -- participants row, completed means a scored result for that athlete.
      EXISTS (
        SELECT 1 FROM public.participants p
        WHERE link.user_id IS NOT NULL AND p.user_id = link.user_id
      ) AS trained,
      EXISTS (
        SELECT 1
        FROM public.participants p
        INNER JOIN public.missions m ON m.id = p.mission_id
        INNER JOIN public.participant_segment_results psr
          ON psr.participant_id = p.id
         AND psr.segment_index = m.segment_index
        WHERE link.user_id IS NOT NULL
          AND p.user_id = link.user_id
          AND psr.final_score IS NOT NULL
      ) AS completed_mission
    FROM per_browser b
    LEFT JOIN public.analytics_identity_links link ON link.anon_id = b.anon_id
  ),
  cohorts AS (
    SELECT 1 AS cohort_order, 'reader_only'::text AS cohort, o.*
    FROM outcomes o
    WHERE o.read_a_page
      AND NOT o.timer_started
      AND NOT o.pacing_scored
      AND NOT o.featured_acted
    UNION ALL
    SELECT 2, 'timer_started'::text, o.* FROM outcomes o WHERE o.timer_started
    UNION ALL
    SELECT 3, 'timer_completed'::text, o.* FROM outcomes o WHERE o.timer_completed
    UNION ALL
    SELECT 4, 'pacing_scored'::text, o.* FROM outcomes o WHERE o.pacing_scored
    UNION ALL
    SELECT 5, 'featured_viewed'::text, o.* FROM outcomes o WHERE o.featured_viewed
    UNION ALL
    SELECT 6, 'featured_acted'::text, o.* FROM outcomes o WHERE o.featured_acted
  )
  SELECT
    cohort_order::int,
    cohort,
    count(*),
    coalesce(sum(cta_clicks), 0),
    count(DISTINCT user_id),
    round(100.0 * count(DISTINCT user_id) / NULLIF(count(*), 0), 2),
    count(DISTINCT user_id) FILTER (WHERE trained),
    count(DISTINCT user_id) FILTER (WHERE completed_mission),
    round(
      100.0 * count(DISTINCT user_id) FILTER (WHERE completed_mission)
        / NULLIF(count(*), 0),
      2
    )
  FROM cohorts
  GROUP BY cohort_order, cohort
  ORDER BY cohort_order;
$$;

REVOKE EXECUTE ON FUNCTION public.report_tool_conversion(timestamptz)
  FROM PUBLIC, anon, authenticated;
