-- Shared coach chart annotations (one note per metric/grain/bucket).
-- First consumer: Guest browsers bars. Client has no table grants — RPC only.

CREATE TABLE IF NOT EXISTS public.coach_chart_notes (
  metric text NOT NULL,
  grain text NOT NULL,
  bucket_start timestamptz NOT NULL,
  body text NOT NULL,
  updated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (metric, grain, bucket_start),
  CONSTRAINT coach_chart_notes_metric_check CHECK (metric = 'guest_browsers'),
  CONSTRAINT coach_chart_notes_grain_check CHECK (grain IN ('hour', 'day')),
  CONSTRAINT coach_chart_notes_body_len_check CHECK (
    length(btrim(body)) > 0 AND length(body) <= 500
  )
);

CREATE INDEX IF NOT EXISTS coach_chart_notes_metric_grain_bucket_idx
  ON public.coach_chart_notes (metric, grain, bucket_start);

ALTER TABLE public.coach_chart_notes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.coach_chart_notes FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.coach_chart_notes_for_range(
  p_metric text,
  p_grain text,
  p_from timestamptz,
  p_to timestamptz
)
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

  IF p_metric IS DISTINCT FROM 'guest_browsers'
    OR p_grain IS NULL
    OR p_grain NOT IN ('hour', 'day')
    OR p_from IS NULL
    OR p_to IS NULL
  THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_args');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'notes', (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'bucketStart', n.bucket_start,
            'body', n.body,
            'updatedAt', n.updated_at,
            'updatedBy', n.updated_by
          )
          ORDER BY n.bucket_start
        ),
        '[]'::jsonb
      )
      FROM public.coach_chart_notes n
      WHERE n.metric = p_metric
        AND n.grain = p_grain
        AND n.bucket_start >= p_from
        AND n.bucket_start <= p_to
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.coach_chart_note_upsert(
  p_metric text,
  p_grain text,
  p_bucket_start timestamptz,
  p_body text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_body text;
  v_note public.coach_chart_notes%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_metric IS DISTINCT FROM 'guest_browsers'
    OR p_grain IS NULL
    OR p_grain NOT IN ('hour', 'day')
    OR p_bucket_start IS NULL
  THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_args');
  END IF;

  v_body := btrim(coalesce(p_body, ''));

  IF v_body = '' THEN
    DELETE FROM public.coach_chart_notes
    WHERE metric = p_metric
      AND grain = p_grain
      AND bucket_start = p_bucket_start;
    RETURN jsonb_build_object('ok', true, 'deleted', true);
  END IF;

  IF length(v_body) > 500 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'body_too_long');
  END IF;

  INSERT INTO public.coach_chart_notes (
    metric,
    grain,
    bucket_start,
    body,
    updated_by,
    updated_at
  )
  VALUES (
    p_metric,
    p_grain,
    p_bucket_start,
    v_body,
    v_uid,
    now()
  )
  ON CONFLICT (metric, grain, bucket_start) DO UPDATE
  SET
    body = excluded.body,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  RETURNING * INTO v_note;

  RETURN jsonb_build_object(
    'ok', true,
    'deleted', false,
    'note', jsonb_build_object(
      'bucketStart', v_note.bucket_start,
      'body', v_note.body,
      'updatedAt', v_note.updated_at,
      'updatedBy', v_note.updated_by
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_chart_notes_for_range(text, text, timestamptz, timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_chart_notes_for_range(text, text, timestamptz, timestamptz)
  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.coach_chart_note_upsert(text, text, timestamptz, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_chart_note_upsert(text, text, timestamptz, text)
  TO authenticated;
