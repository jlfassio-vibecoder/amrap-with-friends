-- Phase 6: Coach “now” sets from presence_heartbeat events.
-- Supabase Presence cannot track without joining the topic, and joining
-- delivers the full roster to every subscriber — so the SPA no longer
-- joins presence:global. See src/hooks/useGlobalPresenceBroadcast.ts.

CREATE OR REPLACE FUNCTION public.coach_online_now()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'userIds', (
      SELECT coalesce(jsonb_agg(u.uid), '[]'::jsonb)
      FROM (
        SELECT DISTINCT ae.user_id AS uid
        FROM public.analytics_events ae
        WHERE ae.event_name = 'presence_heartbeat'
          AND ae.occurred_at >= now() - interval '90 seconds'
          AND ae.user_id IS NOT NULL
      ) u
    ),
    'anonIds', (
      SELECT coalesce(jsonb_agg(a.aid), '[]'::jsonb)
      FROM (
        SELECT DISTINCT ae.anon_id AS aid
        FROM public.analytics_events ae
        WHERE ae.event_name = 'presence_heartbeat'
          AND ae.occurred_at >= now() - interval '90 seconds'
          AND ae.user_id IS NULL
          AND ae.anon_id IS NOT NULL
          AND ae.anon_id <> 'unknown'
          AND ae.anon_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      ) a
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_online_now() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_online_now() TO authenticated;
