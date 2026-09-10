-- Honest guest metric: additive guestBrowsers7d on coach_dashboard topStrip.
-- uniqueAnonIds stays so older clients still parse.

CREATE OR REPLACE FUNCTION public.coach_dashboard()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'topStrip', jsonb_build_object(
      'missionsCreated7d', (
        SELECT count(*) FROM public.missions WHERE created_at >= now() - interval '7 days'
      ),
      'missionsCreated30d', (
        SELECT count(*) FROM public.missions WHERE created_at >= now() - interval '30 days'
      ),
      'missionsFinished7d', (
        SELECT count(*) FROM public.missions
        WHERE state = 'finished' AND created_at >= now() - interval '7 days'
      ),
      'missionsFinished30d', (
        SELECT count(*) FROM public.missions
        WHERE state = 'finished' AND created_at >= now() - interval '30 days'
      ),
      'guestBrowsers7d', (
        SELECT count(DISTINCT anon_id)
        FROM public.analytics_events
        WHERE user_id IS NULL
          AND occurred_at >= now() - interval '7 days'
          AND anon_id IS NOT NULL
          AND anon_id <> ''
          AND anon_id <> 'unknown'
      ),
      'uniqueAnonIds', (
        SELECT count(DISTINCT anon_id) FROM public.analytics_events WHERE anon_id IS NOT NULL
      ),
      'registeredUsers', (SELECT count(*) FROM public.athlete_profiles),
      'practiceMissionsStarted', (
        SELECT count(*) FROM public.analytics_events WHERE event_name = 'practice_started'
      ),
      'liveMissionsCreated', (
        SELECT count(*) FROM public.analytics_events WHERE event_name = 'mission_created'
      )
    ),
    'claimFunnel', (SELECT to_jsonb(v) FROM public.v_claim_funnel v),
    'intakeFunnel', (SELECT to_jsonb(v) FROM public.v_intake_funnel v),
    'rallyConversion', (SELECT to_jsonb(v) FROM public.v_rally_conversion v),
    'missionAbandonment', (SELECT to_jsonb(v) FROM public.v_mission_abandonment v),
    'templatePerformance', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.v_template_performance v
    ),
    'hostVsJoinerRetention', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.v_host_vs_joiner_retention v
    ),
    'audioUnlockRate', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.v_audio_unlock_rate v
    ),
    'rpcReliability', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.v_rpc_reliability v
    ),
    'realtimeReliability', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.v_realtime_reliability v
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.coach_dashboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_dashboard() TO authenticated;
