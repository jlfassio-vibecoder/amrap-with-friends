-- Two questions the dashboard could not answer: does anyone come back, and
-- does training with friends make any difference.
--
-- What the coach page calls "cohorts" (activityCohorts.ts) is recency
-- buckets -- active now, 24h, 7d, lapsed. That is a snapshot of who is warm,
-- not retention: it cannot say whether the people who started last month are
-- still here, so there is no way to tell whether anything we ship works.

-- Weekly cohort retention. A user's cohort is the ISO week of their first
-- mission, and they count as retained in week N if they took part in any
-- mission that week.
--
-- Two deliberate choices:
--
--   * Cohorted on first *participation*, not on account creation. Signing up
--     and never training is an onboarding problem, already measured by the
--     claim and intake funnels; this view is about whether training sticks.
--   * Registered users only. Retention needs a durable identity across weeks,
--     and an anon_id is per-browser -- it does not survive a cleared cache or
--     a second device, so guest "retention" would mostly measure cookie
--     lifetime. coach_identity_journey is the guest-side answer.
CREATE OR REPLACE FUNCTION public.report_weekly_retention(
  p_weeks int DEFAULT 12,
  p_max_offset int DEFAULT 8
)
RETURNS TABLE (
  cohort_week date,
  cohort_size bigint,
  week_offset int,
  retained bigint,
  retained_pct numeric
)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  WITH first_mission AS (
    SELECT
      p.user_id,
      date_trunc('week', min(p.joined_at))::date AS cohort_week
    FROM public.participants p
    WHERE p.user_id IS NOT NULL
    GROUP BY p.user_id
  ),
  cohorts AS (
    SELECT cohort_week, count(*) AS cohort_size
    FROM first_mission
    WHERE cohort_week >= date_trunc('week', now())::date - (p_weeks * 7)
    GROUP BY cohort_week
  ),
  activity AS (
    SELECT DISTINCT
      fm.user_id,
      fm.cohort_week,
      (
        (date_trunc('week', p.joined_at)::date - fm.cohort_week) / 7
      )::int AS week_offset
    FROM public.participants p
    INNER JOIN first_mission fm ON fm.user_id = p.user_id
    WHERE p.user_id IS NOT NULL
  )
  SELECT
    c.cohort_week,
    c.cohort_size,
    o.week_offset,
    count(a.user_id),
    round(100.0 * count(a.user_id) / NULLIF(c.cohort_size, 0), 1)
  FROM cohorts c
  -- Every offset is emitted, including the zeroes: a cohort that vanishes in
  -- week 2 must show an explicit 0%, not a missing row that renders as a gap.
  CROSS JOIN generate_series(0, greatest(0, p_max_offset)) AS o(week_offset)
  LEFT JOIN activity a
    ON a.cohort_week = c.cohort_week
   AND a.week_offset = o.week_offset
  -- A cohort cannot be "retained" in a week that has not happened yet.
  WHERE c.cohort_week + (o.week_offset * 7) <= date_trunc('week', now())::date
  GROUP BY c.cohort_week, c.cohort_size, o.week_offset
  ORDER BY c.cohort_week DESC, o.week_offset ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.report_weekly_retention(int, int)
  FROM PUBLIC, anon, authenticated;

-- Does training with other people change anything? The product is called
-- AMRAP With Friends and nothing has ever compared solo against group, so the
-- central premise has been untested.
--
-- Group size is counted from participants on the mission, so it reflects who
-- actually turned up rather than who was invited. "Completed" is a scored
-- result for that participant -- the same definition coach_identity_journey
-- uses -- because a mission reaching state finished says nothing about
-- whether this athlete logged a round.
--
-- Returned-within-14-days is measured per participation and only for rows old
-- enough to have had the full 14 days to come back, so a mission run
-- yesterday cannot drag the rate down.
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
  WITH sized AS (
    SELECT
      p.id,
      p.user_id,
      p.mission_id,
      p.joined_at,
      m.segment_index,
      (SELECT count(*) FROM public.participants other WHERE other.mission_id = p.mission_id)
        AS group_size
    FROM public.participants p
    INNER JOIN public.missions m ON m.id = p.mission_id
    WHERE p_since IS NULL OR p.joined_at >= p_since
  ),
  scored AS (
    SELECT
      s.*,
      CASE WHEN s.group_size > 1 THEN 'social' ELSE 'solo' END AS cohort,
      (psr.final_score IS NOT NULL) AS completed,
      -- Only ask about returning once the window has actually elapsed.
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
