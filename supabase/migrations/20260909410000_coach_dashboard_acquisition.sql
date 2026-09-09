-- coach_dashboard rebuilt from 20260909390000 with the acquisition report added.

CREATE OR REPLACE FUNCTION public.coach_dashboard(p_window text DEFAULT 'all')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $function$
DECLARE
  v_since timestamptz;
  v_window text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_window := lower(coalesce(p_window, 'all'));
  IF v_window NOT IN ('7d', '30d', '90d', 'all') THEN
    RAISE EXCEPTION 'Unsupported window';
  END IF;
  v_since := public.report_window_start(v_window);

  RETURN jsonb_build_object(
    'ok', true,
    'window', v_window,
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
    'claimFunnel', (SELECT to_jsonb(v) FROM public.report_claim_funnel(v_since) v),
    'intakeFunnel', (SELECT to_jsonb(v) FROM public.report_intake_funnel(v_since) v),
    'rallyConversion', (SELECT to_jsonb(v) FROM public.report_rally_conversion(v_since) v),
    'missionAbandonment', (SELECT to_jsonb(v) FROM public.report_mission_abandonment(v_since) v),
    'signupFunnel', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.report_signup_funnel(v_since) v
    ),
    'authFailureReasons', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.report_auth_failure_reasons(v_since) v
    ),
    'campaignFunnel', (SELECT to_jsonb(v) FROM public.report_campaign_funnel(v_since) v),
    'campaignLengthAdherence', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb)
      FROM public.report_campaign_length_adherence(v_since) v
    ),
    'templatePerformance', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.report_template_performance(v_since) v
    ),
    'hostVsJoinerRetention', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb)
      FROM public.report_host_vs_joiner_retention(v_since) v
    ),
    'audioUnlockRate', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.report_audio_unlock_rate(v_since) v
    ),
    'rpcReliability', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.report_rpc_reliability(v_since) v
    ),
    'realtimeReliability', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.report_realtime_reliability(v_since) v
    ),
    'missionDropoff', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.report_mission_dropoff(v_since) v
    ),
    'socialLift', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.report_social_lift(v_since) v
    ),
    -- Retention is not windowed: a cohort curve is the one thing that must
    -- keep looking back past the picker, or week 8 could never be populated.
    'weeklyRetention', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.report_weekly_retention(12, 8) v
    ),
    'acquisition', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.report_acquisition(v_since) v
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.coach_dashboard(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_dashboard(text) TO authenticated;
