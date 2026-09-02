-- Coach list of auth users stuck before / mid intake (no profile or blank names).
-- Complements coach_users_list, which only returns athlete_profiles rows.

CREATE OR REPLACE FUNCTION public.coach_onboarding_stuck_list(p_limit integer DEFAULT 100)
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
          CASE
            WHEN ap.user_id IS NULL THEN 'needs_profile'
            ELSE 'intake_incomplete'
          END AS status,
          au.created_at AS account_created_at,
          au.last_sign_in_at AS last_sign_in_at,
          coalesce(
            (
              SELECT jsonb_agg(to_jsonb(provider) ORDER BY provider)
              FROM (
                SELECT DISTINCT provider
                FROM jsonb_array_elements_text(
                  CASE
                    WHEN jsonb_typeof(au.raw_app_meta_data->'providers') = 'array'
                    THEN au.raw_app_meta_data->'providers'
                    ELSE '[]'::jsonb
                  END
                ) AS provider
                WHERE length(btrim(provider)) > 0
              ) providers
            ),
            '[]'::jsonb
          ) AS providers
        FROM auth.users au
        LEFT JOIN public.athlete_profiles ap ON ap.user_id = au.id
        WHERE
          ap.user_id IS NULL
          OR nullif(btrim(coalesce(ap.username, '')), '') IS NULL
          OR nullif(btrim(coalesce(ap.nickname, '')), '') IS NULL
        ORDER BY au.created_at DESC
        LIMIT v_limit
      ) u
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.coach_onboarding_stuck_list(p_limit integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_onboarding_stuck_list(p_limit integer) TO authenticated;
