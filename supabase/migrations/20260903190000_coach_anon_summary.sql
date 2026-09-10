-- Phase 4 guest tracking: coach dossier for a live Anonymous Now id.
-- Lookup by anon_id over 90 days; optional filter on coach_events_recent.

CREATE INDEX IF NOT EXISTS analytics_events_anon_id_occurred_idx
  ON public.analytics_events (anon_id, occurred_at DESC)
  WHERE anon_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.coach_anon_summary(p_anon_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_anon text;
  v_last_occurred timestamptz;
  v_last_route text;
  v_event_count int;
  v_counts jsonb;
  v_linked_user uuid;
  v_linked_nickname text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_anon := nullif(btrim(coalesce(p_anon_id, '')), '');

  IF v_anon IS NULL
    OR v_anon = 'unknown'
    OR v_anon !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_anon_id');
  END IF;

  SELECT count(*)::int, max(ae.occurred_at)
  INTO v_event_count, v_last_occurred
  FROM public.analytics_events ae
  WHERE ae.anon_id = v_anon
    AND ae.occurred_at >= now() - interval '90 days';

  SELECT ae.route
  INTO v_last_route
  FROM public.analytics_events ae
  WHERE ae.anon_id = v_anon
    AND ae.occurred_at >= now() - interval '90 days'
  ORDER BY ae.occurred_at DESC
  LIMIT 1;

  SELECT coalesce(
    (
      SELECT jsonb_object_agg(counted.event_name, counted.cnt)
      FROM (
        SELECT ae.event_name, count(*)::int AS cnt
        FROM public.analytics_events ae
        WHERE ae.anon_id = v_anon
          AND ae.occurred_at >= now() - interval '90 days'
        GROUP BY ae.event_name
      ) counted
    ),
    '{}'::jsonb
  )
  INTO v_counts;

  SELECT l.user_id, ap.nickname
  INTO v_linked_user, v_linked_nickname
  FROM public.analytics_identity_links l
  LEFT JOIN public.athlete_profiles ap ON ap.user_id = l.user_id
  WHERE l.anon_id = v_anon
  ORDER BY l.first_seen_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'lastOccurredAt', v_last_occurred,
    'lastRoute', v_last_route,
    'eventCount', coalesce(v_event_count, 0),
    'eventNameCounts', coalesce(v_counts, '{}'::jsonb),
    'linkedUserId', v_linked_user,
    'linkedNickname', v_linked_nickname
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_anon_summary(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_anon_summary(text) TO authenticated;

DROP FUNCTION IF EXISTS public.coach_events_recent(text, int, uuid);

CREATE OR REPLACE FUNCTION public.coach_events_recent(
  p_event_name text DEFAULT NULL,
  p_limit int DEFAULT 100,
  p_user_id uuid DEFAULT NULL,
  p_anon_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
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
    'events', (
      SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.occurred_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          ae.id,
          ae.event_name,
          ae.occurred_at,
          ae.mission_id,
          ae.participant_id,
          ae.user_id,
          ae.anon_id,
          ae.route,
          ae.props
        FROM public.analytics_events ae
        WHERE (p_event_name IS NULL OR ae.event_name = p_event_name)
          AND (
            p_user_id IS NULL
            OR ae.user_id = p_user_id
            OR ae.participant_id IN (
              SELECT id FROM public.participants WHERE user_id = p_user_id
            )
          )
          AND (p_anon_id IS NULL OR ae.anon_id = p_anon_id)
        ORDER BY ae.occurred_at DESC
        LIMIT v_limit
      ) e
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_events_recent(text, int, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_events_recent(text, int, uuid, text) TO authenticated;
