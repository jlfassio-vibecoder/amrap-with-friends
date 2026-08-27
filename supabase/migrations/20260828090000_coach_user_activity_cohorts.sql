-- Coach "resume activity" outreach support: broaden last_active_at to
-- cover any signal of app usage (not just joining an AMRAP session), and
-- add an activity-recency bucket filter so a coach can list users by how
-- long it's been since they were last seen — the standard cohorts used
-- for "come back" reminder outreach (24h / 3d / 7d / lapsed 7d+).
--
-- "Active now" (live/realtime) is intentionally NOT a server-side bucket
-- here: it reflects who currently has the app open via Supabase Realtime
-- Presence, which is ephemeral client state, not something SQL can see.
-- The client filters the 'all' list against the live presence set for
-- that cohort instead.

CREATE INDEX IF NOT EXISTS analytics_events_user_occurred_idx
  ON public.analytics_events (user_id, occurred_at)
  WHERE user_id IS NOT NULL;

DROP FUNCTION IF EXISTS public.coach_users_list(text, int);

CREATE OR REPLACE FUNCTION public.coach_users_list(
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_activity_bucket text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_limit int;
  v_search text;
  v_bucket text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_limit := LEAST(GREATEST(coalesce(p_limit, 50), 1), 200);
  v_search := nullif(btrim(coalesce(p_search, '')), '');
  v_bucket := nullif(btrim(coalesce(p_activity_bucket, '')), '');

  IF v_bucket IS NOT NULL AND v_bucket NOT IN ('last_24h', 'last_3d', 'last_7d', 'lapsed') THEN
    RAISE EXCEPTION 'Invalid activity bucket';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'users', (
      WITH last_activity AS (
        -- last_active_at = the most recent of: joining a live AMRAP
        -- session, logging outside physical activity, or any tracked
        -- analytics event. A user who only logs outside workouts (no
        -- AMRAP participation) should not look permanently lapsed.
        SELECT
          ap.user_id,
          NULLIF(
            GREATEST(
              coalesce(ps.last_participant_at, '-infinity'::timestamptz),
              coalesce(pa.last_pa_at, '-infinity'::timestamptz),
              coalesce(ev.last_event_at, '-infinity'::timestamptz)
            ),
            '-infinity'::timestamptz
          ) AS last_active_at
        FROM public.athlete_profiles ap
        LEFT JOIN (
          SELECT user_id, max(joined_at) AS last_participant_at
          FROM public.participants
          WHERE user_id IS NOT NULL
          GROUP BY user_id
        ) ps ON ps.user_id = ap.user_id
        LEFT JOIN (
          SELECT user_id, max(occurred_at) AS last_pa_at
          FROM public.physical_activity_log
          GROUP BY user_id
        ) pa ON pa.user_id = ap.user_id
        LEFT JOIN (
          SELECT user_id, max(occurred_at) AS last_event_at
          FROM public.analytics_events
          WHERE user_id IS NOT NULL
          GROUP BY user_id
        ) ev ON ev.user_id = ap.user_id
      )
      SELECT coalesce(jsonb_agg(u ORDER BY u.last_active_at DESC NULLS LAST), '[]'::jsonb)
      FROM (
        SELECT
          ap.user_id,
          ap.username,
          ap.nickname,
          au.email,
          ap.perceived_classification,
          ap.created_at AS account_created_at,
          la.last_active_at,
          coalesce(session_counts.total_sessions, 0) AS total_sessions
        FROM public.athlete_profiles ap
        JOIN auth.users au ON au.id = ap.user_id
        LEFT JOIN last_activity la ON la.user_id = ap.user_id
        LEFT JOIN (
          SELECT p.user_id, count(DISTINCT p.session_id) AS total_sessions
          FROM public.participants p
          WHERE p.user_id IS NOT NULL
          GROUP BY p.user_id
        ) session_counts ON session_counts.user_id = ap.user_id
        WHERE
          (
            v_search IS NULL
            OR ap.username ILIKE '%' || v_search || '%'
            OR ap.nickname ILIKE '%' || v_search || '%'
            OR au.email ILIKE '%' || v_search || '%'
          )
          AND (
            v_bucket IS NULL
            OR (v_bucket = 'last_24h' AND la.last_active_at >= now() - interval '1 day')
            OR (v_bucket = 'last_3d' AND la.last_active_at >= now() - interval '3 days')
            OR (v_bucket = 'last_7d' AND la.last_active_at >= now() - interval '7 days')
            OR (
              v_bucket = 'lapsed'
              AND (la.last_active_at IS NULL OR la.last_active_at < now() - interval '7 days')
            )
          )
        ORDER BY la.last_active_at DESC NULLS LAST, ap.created_at DESC
        LIMIT v_limit
      ) u
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_users_list(text, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_users_list(text, int, text) TO authenticated;
