-- Fix coach_events_recent: jsonb_agg must ORDER BY inside the aggregate so
-- the Explore table receives events in chronological order.

CREATE OR REPLACE FUNCTION public.coach_events_recent(
  p_event_name text DEFAULT NULL,
  p_limit int DEFAULT 100
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
      SELECT coalesce(
        jsonb_agg(to_jsonb(e) ORDER BY e.occurred_at DESC),
        '[]'::jsonb
      )
      FROM (
        SELECT
          id,
          event_name,
          occurred_at,
          session_id,
          participant_id,
          user_id,
          anon_id,
          route,
          props
        FROM public.analytics_events
        WHERE p_event_name IS NULL OR event_name = p_event_name
        ORDER BY occurred_at DESC
        LIMIT v_limit
      ) e
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_events_recent(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_events_recent(text, int) TO authenticated;
