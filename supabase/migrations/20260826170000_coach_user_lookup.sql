-- Coach user lookup & support: directory search + per-user detail, both
-- gated on is_coach() like every other coach_* RPC.

CREATE OR REPLACE FUNCTION public.coach_users_list(
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_limit int;
  v_search text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_limit := LEAST(GREATEST(coalesce(p_limit, 50), 1), 200);
  v_search := nullif(btrim(coalesce(p_search, '')), '');

  RETURN jsonb_build_object(
    'ok', true,
    'users', (
      SELECT coalesce(jsonb_agg(u ORDER BY u.last_active_at DESC NULLS LAST), '[]'::jsonb)
      FROM (
        SELECT
          ap.user_id,
          ap.username,
          ap.nickname,
          au.email,
          ap.perceived_classification,
          ap.created_at AS account_created_at,
          last_session.last_active_at,
          coalesce(session_counts.total_sessions, 0) AS total_sessions
        FROM public.athlete_profiles ap
        JOIN auth.users au ON au.id = ap.user_id
        LEFT JOIN (
          SELECT p.user_id, max(p.joined_at) AS last_active_at
          FROM public.participants p
          WHERE p.user_id IS NOT NULL
          GROUP BY p.user_id
        ) last_session ON last_session.user_id = ap.user_id
        LEFT JOIN (
          SELECT p.user_id, count(DISTINCT p.session_id) AS total_sessions
          FROM public.participants p
          WHERE p.user_id IS NOT NULL
          GROUP BY p.user_id
        ) session_counts ON session_counts.user_id = ap.user_id
        WHERE
          v_search IS NULL
          OR ap.username ILIKE '%' || v_search || '%'
          OR ap.nickname ILIKE '%' || v_search || '%'
          OR au.email ILIKE '%' || v_search || '%'
        LIMIT v_limit
      ) u
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_users_list(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_users_list(text, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.coach_user_detail(p_user_id uuid)
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

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'profile', (
      SELECT jsonb_build_object(
        'userId', ap.user_id,
        'username', ap.username,
        'nickname', ap.nickname,
        'email', au.email,
        'heightCm', ap.height_cm,
        'weightKg', ap.weight_kg,
        'birthYear', ap.birth_year,
        'biologicalSex', ap.biological_sex,
        'perceivedClassification', ap.perceived_classification,
        'accountCreatedAt', ap.created_at
      )
      FROM public.athlete_profiles ap
      JOIN auth.users au ON au.id = ap.user_id
      WHERE ap.user_id = p_user_id
    ),
    'classificationHistory', (
      SELECT coalesce(jsonb_agg(h ORDER BY h.occurred_at DESC), '[]'::jsonb)
      FROM public.athlete_classification_history h
      WHERE h.user_id = p_user_id
    ),
    'sessions', (
      SELECT coalesce(jsonb_agg(s ORDER BY s.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          se.id AS session_id,
          p.role,
          se.template_id,
          se.intensity_tier,
          se.duration_minutes,
          se.state,
          psr.final_score,
          se.created_at,
          p.joined_at
        FROM public.participants p
        JOIN public.sessions se ON se.id = p.session_id
        LEFT JOIN public.participant_segment_results psr
          ON psr.participant_id = p.id AND psr.segment_index = se.segment_index
        WHERE p.user_id = p_user_id
      ) s
    ),
    'summary', jsonb_build_object(
      'sessionsAsHost', (
        SELECT count(DISTINCT p.session_id)
        FROM public.participants p
        WHERE p.user_id = p_user_id AND p.role = 'host'
      ),
      'sessionsAsJoiner', (
        SELECT count(DISTINCT p.session_id)
        FROM public.participants p
        WHERE p.user_id = p_user_id AND p.role = 'joiner'
      ),
      'totalSessions', (
        SELECT count(DISTINCT p.session_id)
        FROM public.participants p
        WHERE p.user_id = p_user_id
      ),
      'practiceSessionsStarted', (
        SELECT count(*)
        FROM public.analytics_events
        WHERE event_name = 'practice_started'
          AND (
            user_id = p_user_id
            OR participant_id IN (
              SELECT id FROM public.participants WHERE user_id = p_user_id
            )
          )
      ),
      'firstSeenAt', (
        SELECT min(p.joined_at) FROM public.participants p WHERE p.user_id = p_user_id
      ),
      'lastActiveAt', (
        SELECT max(p.joined_at) FROM public.participants p WHERE p.user_id = p_user_id
      )
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_user_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_user_detail(uuid) TO authenticated;

-- Extend coach_events_recent with an optional per-user filter. Most
-- events only carry user_id for session_created/session_joined/claim_* —
-- everything else was only ever tagged with participant_id, so a correct
-- per-user filter has to join through participants rather than trusting
-- analytics_events.user_id alone.
DROP FUNCTION IF EXISTS public.coach_events_recent(text, int);

CREATE OR REPLACE FUNCTION public.coach_events_recent(
  p_event_name text DEFAULT NULL,
  p_limit int DEFAULT 100,
  p_user_id uuid DEFAULT NULL
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
          ae.session_id,
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
        ORDER BY ae.occurred_at DESC
        LIMIT v_limit
      ) e
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_events_recent(text, int, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_events_recent(text, int, uuid) TO authenticated;
