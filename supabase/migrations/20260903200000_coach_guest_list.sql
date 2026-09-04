-- Phase 5 guest tracking: historical unlinked guest browsers by last event.
-- Same activity buckets as coach_users_list; presence is not the filter.

CREATE OR REPLACE FUNCTION public.coach_guest_list(
  p_activity_bucket text,
  p_limit int DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_limit int;
  v_bucket text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_limit := LEAST(GREATEST(coalesce(p_limit, 200), 1), 200);
  v_bucket := nullif(btrim(coalesce(p_activity_bucket, '')), '');

  IF v_bucket IS NULL OR v_bucket NOT IN ('last_24h', 'last_3d', 'last_7d', 'lapsed') THEN
    RAISE EXCEPTION 'Invalid activity bucket';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'guests', (
      SELECT coalesce(jsonb_agg(g ORDER BY g.last_occurred_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          ae.anon_id,
          max(ae.occurred_at) AS last_occurred_at
        FROM public.analytics_events ae
        WHERE ae.anon_id IS NOT NULL
          AND btrim(ae.anon_id) <> ''
          AND ae.anon_id <> 'unknown'
          AND ae.anon_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          AND NOT EXISTS (
            SELECT 1
            FROM public.analytics_identity_links l
            WHERE l.anon_id = ae.anon_id
          )
        GROUP BY ae.anon_id
        HAVING
          (v_bucket = 'last_24h' AND max(ae.occurred_at) >= now() - interval '1 day')
          OR (v_bucket = 'last_3d' AND max(ae.occurred_at) >= now() - interval '3 days')
          OR (v_bucket = 'last_7d' AND max(ae.occurred_at) >= now() - interval '7 days')
          OR (v_bucket = 'lapsed' AND max(ae.occurred_at) < now() - interval '7 days')
        ORDER BY max(ae.occurred_at) DESC
        LIMIT v_limit
      ) g
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_guest_list(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_guest_list(text, int) TO authenticated;
