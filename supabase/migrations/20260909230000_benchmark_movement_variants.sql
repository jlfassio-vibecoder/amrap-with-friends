-- A benchmark remembers how it was performed, not only that it was.
--
-- version_key already records which version a benchmark measures, and
-- available_ghosts matches on it. But the key is a one-way fingerprint: names
-- are joined with '|' and '#', so a movement name containing either cannot be
-- recovered from it, and movementVersion.ts deliberately never tries.
--
-- Phase 2's retest opens the same workout at the same clock with the same
-- modification already chosen. Without the variants themselves, a retest would
-- default to "as programmed", so an athlete who benchmarked on knee push-ups
-- would silently retest on full ones and the comparison the feature exists for
-- would be wrong by default. Storing the selection alongside the key is the
-- cheap half of that; deriving it from the key is the impossible half.
--
-- The key stays the thing matched on. This column is only ever read to seed a
-- retest, so the two cannot disagree about what an attempt is.

ALTER TABLE public.athlete_benchmarks
  ADD COLUMN IF NOT EXISTS movement_variants jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.athlete_benchmarks
  DROP CONSTRAINT IF EXISTS athlete_benchmarks_movement_variants_shape;

ALTER TABLE public.athlete_benchmarks
  ADD CONSTRAINT athlete_benchmarks_movement_variants_shape CHECK (
    jsonb_typeof(movement_variants) = 'object'
    AND length(movement_variants::text) <= 2000
  );


-- designate_benchmark gains the selection. The old 4-argument signature is
-- dropped rather than left beside it: two overloads differing only in a
-- defaulted trailing argument make every call ambiguous.
DROP FUNCTION IF EXISTS public.designate_benchmark(text, int, int, text);

CREATE OR REPLACE FUNCTION public.designate_benchmark(
  p_template_id text,
  p_duration_minutes int,
  p_time_domain int,
  p_version_key text DEFAULT '',
  p_movement_variants jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $function$
DECLARE
  v_uid uuid;
  v_template text;
  v_active int;
  v_row public.athlete_benchmarks%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_template := trim(coalesce(p_template_id, ''));
  IF v_template = '' OR length(v_template) > 120 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_template');
  END IF;

  -- Library templates only. A coach can edit their own workout underneath a
  -- stored benchmark, which is exactly what benchmarkFingerprints.ts prevents
  -- for the campaign benchmarks — and nothing fingerprints a coach workout.
  IF v_template LIKE 'coach:%' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'coach_workout');
  END IF;

  IF p_time_domain IS NULL OR p_time_domain NOT IN (5, 10, 15, 20) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_domain');
  END IF;

  SELECT count(*)::int
  INTO v_active
  FROM public.athlete_benchmarks
  WHERE user_id = v_uid AND retired_at IS NULL;

  IF v_active >= 3 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'at_limit');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.athlete_benchmarks
    WHERE user_id = v_uid AND retired_at IS NULL AND time_domain = p_time_domain
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'domain_taken');
  END IF;

  BEGIN
    INSERT INTO public.athlete_benchmarks (
      user_id, template_id, duration_minutes, time_domain, version_key, movement_variants
    )
    VALUES (
      v_uid, v_template, p_duration_minutes, p_time_domain, left(coalesce(p_version_key, ''), 2000),
      CASE
        WHEN jsonb_typeof(p_movement_variants) = 'object' THEN p_movement_variants
        ELSE '{}'::jsonb
      END
    )
    RETURNING * INTO v_row;
  EXCEPTION
    -- The partial unique index is the authority; the check above is only there
    -- to give a useful reason without relying on an error path.
    WHEN unique_violation THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'domain_taken');
    WHEN check_violation THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_duration');
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'benchmark', jsonb_build_object(
      'id', v_row.id,
      'template_id', v_row.template_id,
      'duration_minutes', v_row.duration_minutes,
      'time_domain', v_row.time_domain,
      'version_key', v_row.version_key,
      'movement_variants', v_row.movement_variants,
      'designated_at', v_row.designated_at,
      'retired_at', v_row.retired_at
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.designate_benchmark(text, int, int, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.designate_benchmark(text, int, int, text, jsonb) TO authenticated;


CREATE OR REPLACE FUNCTION public.my_benchmarks()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $function$
DECLARE
  v_uid uuid;
  v_rows jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', b.id,
        'template_id', b.template_id,
        'duration_minutes', b.duration_minutes,
        'time_domain', b.time_domain,
        'version_key', b.version_key,
        'movement_variants', b.movement_variants,
        'designated_at', b.designated_at,
        'retired_at', b.retired_at
      )
      ORDER BY b.designated_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_rows
  FROM public.athlete_benchmarks b
  WHERE b.user_id = v_uid;

  RETURN jsonb_build_object('ok', true, 'benchmarks', v_rows);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.my_benchmarks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_benchmarks() TO authenticated;
