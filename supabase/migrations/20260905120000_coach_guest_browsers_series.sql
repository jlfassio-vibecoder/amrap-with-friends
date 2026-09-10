-- Guest browsers multi-window series for the Coach Overview drill-down.
-- Strip still uses guestBrowsers7d on coach_dashboard; this RPC feeds the panel.

CREATE INDEX IF NOT EXISTS analytics_events_guest_occurred_anon_idx
  ON public.analytics_events (occurred_at DESC, anon_id)
  WHERE user_id IS NULL
    AND anon_id IS NOT NULL
    AND anon_id <> ''
    AND anon_id <> 'unknown';

CREATE OR REPLACE FUNCTION public.coach_guest_browsers_series(p_window text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_window text := lower(btrim(coalesce(p_window, '')));
  v_interval interval;
  v_grain text;
  v_window_start timestamptz;
  v_total bigint;
  v_points jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  CASE v_window
    WHEN '24h' THEN
      v_interval := interval '1 day';
      v_grain := 'hour';
    WHEN '3d' THEN
      v_interval := interval '3 days';
      v_grain := 'day';
    WHEN '7d' THEN
      v_interval := interval '7 days';
      v_grain := 'day';
    WHEN '30d' THEN
      v_interval := interval '30 days';
      v_grain := 'day';
    WHEN '90d' THEN
      v_interval := interval '90 days';
      v_grain := 'day';
    WHEN '365d' THEN
      v_interval := interval '365 days';
      v_grain := 'day';
    ELSE
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_window');
  END CASE;

  v_window_start := now() - v_interval;

  SELECT count(DISTINCT ae.anon_id)
  INTO v_total
  FROM public.analytics_events ae
  WHERE ae.user_id IS NULL
    AND ae.occurred_at >= v_window_start
    AND ae.anon_id IS NOT NULL
    AND ae.anon_id <> ''
    AND ae.anon_id <> 'unknown';

  WITH buckets AS (
    SELECT generate_series(
      date_trunc(v_grain, v_window_start),
      date_trunc(v_grain, now()),
      CASE WHEN v_grain = 'hour' THEN interval '1 hour' ELSE interval '1 day' END
    ) AS bucket_start
  ),
  counts AS (
    SELECT
      date_trunc(v_grain, ae.occurred_at) AS bucket_start,
      count(DISTINCT ae.anon_id)::int AS guest_count
    FROM public.analytics_events ae
    WHERE ae.user_id IS NULL
      AND ae.occurred_at >= v_window_start
      AND ae.anon_id IS NOT NULL
      AND ae.anon_id <> ''
      AND ae.anon_id <> 'unknown'
    GROUP BY 1
  )
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'bucketStart', b.bucket_start,
        'count', coalesce(c.guest_count, 0)
      )
      ORDER BY b.bucket_start
    ),
    '[]'::jsonb
  )
  INTO v_points
  FROM buckets b
  LEFT JOIN counts c ON c.bucket_start = b.bucket_start;

  RETURN jsonb_build_object(
    'ok', true,
    'window', v_window,
    'grain', v_grain,
    'total', coalesce(v_total, 0),
    'points', v_points
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_guest_browsers_series(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_guest_browsers_series(text) TO authenticated;
