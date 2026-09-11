-- Coach list RPCs: profile-complete inactive athletes, and waiting-room graveyard.

CREATE OR REPLACE FUNCTION public.coach_activation_inactive_list(p_limit integer DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions', 'auth'
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
    'users', (
      SELECT coalesce(jsonb_agg(u ORDER BY u.account_created_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          au.id AS user_id,
          au.email,
          ap.username,
          ap.nickname,
          (
            SELECT count(*)::int
            FROM public.participants p
            WHERE p.user_id = au.id
          ) AS missions_touched,
          au.created_at AS account_created_at,
          au.last_sign_in_at AS last_sign_in_at
        FROM public.athlete_profiles ap
        INNER JOIN auth.users au ON au.id = ap.user_id
        WHERE nullif(btrim(coalesce(ap.username, '')), '') IS NOT NULL
          AND nullif(btrim(coalesce(ap.nickname, '')), '') IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM public.participants p
            INNER JOIN public.missions m ON m.id = p.mission_id
            INNER JOIN public.participant_segment_results psr
              ON psr.participant_id = p.id
             AND psr.segment_index = m.segment_index
            WHERE p.user_id = au.id
              AND psr.final_score IS NOT NULL
          )
        ORDER BY au.created_at DESC
        LIMIT v_limit
      ) u
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.coach_waiting_graveyard_list(p_limit integer DEFAULT 100)
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
            nullif(btrim(coalesce(mi.template_id, '')), ''),
            'Untitled mission'
          ) AS workout_name,
          round(extract(epoch FROM (now() - mi.created_at)) / 3600.0, 1) AS age_hours
        FROM public.missions mi
        WHERE mi.state IN ('waiting', 'setup')
          AND mi.created_at < now() - interval '2 hours'
        ORDER BY mi.created_at ASC
        LIMIT v_limit
      ) m
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.coach_activation_inactive_list(p_limit integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_activation_inactive_list(p_limit integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.coach_waiting_graveyard_list(p_limit integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_waiting_graveyard_list(p_limit integer) TO authenticated;
