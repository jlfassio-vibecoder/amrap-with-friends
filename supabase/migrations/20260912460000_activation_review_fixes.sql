-- Activation review fixes: funnel semantics, drop claimed, overdue graveyard.

-- Return shape changed (claimed columns removed) — must DROP before recreate.
DROP FUNCTION IF EXISTS public.report_activation_funnel(timestamptz);

CREATE FUNCTION public.report_activation_funnel(p_since timestamptz DEFAULT NULL)
RETURNS TABLE (
  signed_up bigint,
  identity_complete bigint,
  create_viewed bigint,
  mission_created bigint,
  mission_started bigint,
  finished bigint,
  identity_rate_pct numeric,
  create_viewed_rate_pct numeric,
  mission_created_rate_pct numeric,
  mission_started_rate_pct numeric,
  finished_rate_pct numeric
)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions, auth
AS $$
  WITH cohort AS (
    SELECT au.id AS user_id
    FROM auth.users au
    WHERE p_since IS NULL OR au.created_at >= p_since
  ),
  flags AS (
    SELECT
      c.user_id,
      EXISTS (
        SELECT 1
        FROM public.athlete_profiles ap
        WHERE ap.user_id = c.user_id
          AND nullif(btrim(coalesce(ap.username, '')), '') IS NOT NULL
          AND nullif(btrim(coalesce(ap.nickname, '')), '') IS NOT NULL
      ) AS identity_complete,
      EXISTS (
        SELECT 1
        FROM public.analytics_events ae
        WHERE ae.user_id = c.user_id
          AND ae.event_name = 'create_viewed'
      ) AS create_viewed,
      (
        EXISTS (
          SELECT 1
          FROM public.analytics_events ae
          WHERE ae.user_id = c.user_id
            AND ae.event_name = 'mission_created'
        )
        OR EXISTS (
          SELECT 1
          FROM public.participants p
          WHERE p.user_id = c.user_id
            AND p.role = 'host'
        )
      ) AS mission_created,
      (
        EXISTS (
          SELECT 1
          FROM public.analytics_events ae
          WHERE ae.user_id = c.user_id
            AND ae.event_name = 'mission_started'
        )
        OR EXISTS (
          SELECT 1
          FROM public.participants p
          INNER JOIN public.missions m ON m.id = p.mission_id
          WHERE p.user_id = c.user_id
            AND p.role = 'host'
            AND (m.state IN ('work', 'finished') OR m.started_at IS NOT NULL)
        )
      ) AS mission_started,
      EXISTS (
        SELECT 1
        FROM public.participants p
        INNER JOIN public.missions m ON m.id = p.mission_id
        INNER JOIN public.participant_segment_results psr
          ON psr.participant_id = p.id
         AND psr.segment_index = m.segment_index
        WHERE p.user_id = c.user_id
          AND p.role = 'host'
          AND psr.final_score IS NOT NULL
      ) AS finished
    FROM cohort c
  ),
  totals AS (
    SELECT
      count(*)::bigint AS signed_up,
      count(*) FILTER (WHERE identity_complete)::bigint AS identity_complete,
      count(*) FILTER (WHERE create_viewed)::bigint AS create_viewed,
      count(*) FILTER (WHERE mission_created)::bigint AS mission_created,
      count(*) FILTER (WHERE mission_started)::bigint AS mission_started,
      count(*) FILTER (WHERE finished)::bigint AS finished
    FROM flags
  )
  SELECT
    t.signed_up,
    t.identity_complete,
    t.create_viewed,
    t.mission_created,
    t.mission_started,
    t.finished,
    round(100.0 * t.identity_complete / NULLIF(t.signed_up, 0), 2),
    round(100.0 * t.create_viewed / NULLIF(t.identity_complete, 0), 2),
    round(100.0 * t.mission_created / NULLIF(t.create_viewed, 0), 2),
    round(100.0 * t.mission_started / NULLIF(t.mission_created, 0), 2),
    round(100.0 * t.finished / NULLIF(t.mission_started, 0), 2)
  FROM totals t;
$$;

CREATE OR REPLACE FUNCTION public.report_waiting_graveyard(p_since timestamptz DEFAULT NULL)
RETURNS TABLE (
  waiting_or_setup bigint,
  older_than_2h bigint,
  older_than_24h bigint
)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT
    count(*)::bigint,
    count(*) FILTER (WHERE created_at < now() - interval '2 hours')::bigint,
    count(*) FILTER (WHERE created_at < now() - interval '24 hours')::bigint
  FROM public.missions
  WHERE state IN ('waiting', 'setup')
    AND (scheduled_at IS NULL OR scheduled_at < now() - interval '2 hours')
    AND (p_since IS NULL OR created_at >= p_since);
$$;

DROP FUNCTION IF EXISTS public.coach_waiting_graveyard_list(integer);

CREATE FUNCTION public.coach_waiting_graveyard_list(
  p_limit integer DEFAULT 100,
  p_since timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_limit int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_limit := LEAST(GREATEST(coalesce(p_limit, 100), 1), 200);

  RETURN jsonb_build_object(
    'ok', true,
    'missions', (
      SELECT coalesce(jsonb_agg(m ORDER BY m.created_at ASC), '[]'::jsonb)
      FROM (
        SELECT
          mi.id AS mission_id,
          mi.state,
          mi.created_at,
          coalesce(
            nullif(btrim(coalesce(mi.workout->>'name', '')), ''),
            nullif(btrim(coalesce(mi.workout->0->>'name', '')), ''),
            nullif(btrim(coalesce(mi.template_id, '')), ''),
            'Untitled mission'
          ) AS workout_name,
          round(extract(epoch FROM (now() - mi.created_at)) / 3600.0, 1) AS age_hours
        FROM public.missions mi
        WHERE mi.state IN ('waiting', 'setup')
          AND mi.created_at < now() - interval '2 hours'
          AND (mi.scheduled_at IS NULL OR mi.scheduled_at < now() - interval '2 hours')
          AND (p_since IS NULL OR mi.created_at >= p_since)
        ORDER BY mi.created_at ASC
        LIMIT v_limit
      ) m
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.report_activation_funnel(timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.report_waiting_graveyard(timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.coach_waiting_graveyard_list(integer, timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_waiting_graveyard_list(integer, timestamptz)
  TO authenticated;
