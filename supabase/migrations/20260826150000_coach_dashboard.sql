-- Coach dashboard: allowlist + aggregate RPCs. No client role gets direct
-- access to coach_users or the reporting views — everything goes through
-- these SECURITY DEFINER RPCs, each gated on is_coach(). Add a coach by
-- inserting their auth.users id into coach_users via the SQL editor
-- (service role) — there is no self-serve UI for this by design.

CREATE TABLE IF NOT EXISTS public.coach_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE public.coach_users FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_coach()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coach_users WHERE user_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_coach() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_coach() TO authenticated;

-- Aggregated dashboard: top-strip product counters plus every Phase 4
-- reporting view, one round trip. Sub-objects from the views keep their
-- own (snake_case) column names as-is; only the hand-built topStrip
-- object uses camelCase keys, matching hud_telemetry's convention.
CREATE OR REPLACE FUNCTION public.coach_dashboard()
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
    'topStrip', jsonb_build_object(
      'sessionsCreated7d', (
        SELECT count(*) FROM public.sessions WHERE created_at >= now() - interval '7 days'
      ),
      'sessionsCreated30d', (
        SELECT count(*) FROM public.sessions WHERE created_at >= now() - interval '30 days'
      ),
      'sessionsFinished7d', (
        SELECT count(*) FROM public.sessions
        WHERE state = 'finished' AND created_at >= now() - interval '7 days'
      ),
      'sessionsFinished30d', (
        SELECT count(*) FROM public.sessions
        WHERE state = 'finished' AND created_at >= now() - interval '30 days'
      ),
      'uniqueAnonIds', (
        SELECT count(DISTINCT anon_id) FROM public.analytics_events WHERE anon_id IS NOT NULL
      ),
      'registeredUsers', (SELECT count(*) FROM public.athlete_profiles),
      'practiceSessionsStarted', (
        SELECT count(*) FROM public.analytics_events WHERE event_name = 'practice_started'
      ),
      'liveSessionsCreated', (
        SELECT count(*) FROM public.analytics_events WHERE event_name = 'session_created'
      )
    ),
    'claimFunnel', (SELECT to_jsonb(v) FROM public.v_claim_funnel v),
    'intakeFunnel', (SELECT to_jsonb(v) FROM public.v_intake_funnel v),
    'rallyConversion', (SELECT to_jsonb(v) FROM public.v_rally_conversion v),
    'sessionAbandonment', (SELECT to_jsonb(v) FROM public.v_session_abandonment v),
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
$$;

REVOKE EXECUTE ON FUNCTION public.coach_dashboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_dashboard() TO authenticated;

-- Minimal capped Explore surface: recent raw events, optionally filtered
-- by event_name. Hard-capped at 200 rows server-side regardless of what's
-- requested, so this never becomes a full-firehose export.
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
      SELECT coalesce(jsonb_agg(e), '[]'::jsonb)
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
