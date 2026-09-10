-- Align guest browsers chart buckets to the selected window length.
-- date_trunc(window_start)..date_trunc(now()) produced N+1 bars (e.g. 8 for “7d”).

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
  v_bucket_count int;
  v_step interval;
  v_window_start timestamptz;
  v_series_start timestamptz;
  v_series_end timestamptz;
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
      v_bucket_count := 24;
      v_step := interval '1 hour';
    WHEN '3d' THEN
      v_interval := interval '3 days';
      v_grain := 'day';
      v_bucket_count := 3;
      v_step := interval '1 day';
    WHEN '7d' THEN
      v_interval := interval '7 days';
      v_grain := 'day';
      v_bucket_count := 7;
      v_step := interval '1 day';
    WHEN '30d' THEN
      v_interval := interval '30 days';
      v_grain := 'day';
      v_bucket_count := 30;
      v_step := interval '1 day';
    WHEN '90d' THEN
      v_interval := interval '90 days';
      v_grain := 'day';
      v_bucket_count := 90;
      v_step := interval '1 day';
    WHEN '365d' THEN
      v_interval := interval '365 days';
      v_grain := 'day';
      v_bucket_count := 365;
      v_step := interval '1 day';
    ELSE
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_window');
  END CASE;

  v_window_start := now() - v_interval;
  v_series_end := date_trunc(v_grain, now());
  v_series_start := v_series_end - (v_bucket_count - 1) * v_step;

  SELECT count(DISTINCT ae.anon_id)
  INTO v_total
  FROM public.analytics_events ae
  WHERE ae.user_id IS NULL
    AND ae.occurred_at >= v_window_start
    AND ae.anon_id IS NOT NULL
    AND ae.anon_id <> ''
    AND ae.anon_id <> 'unknown';

  WITH buckets AS (
    SELECT generate_series(v_series_start, v_series_end, v_step) AS bucket_start
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
