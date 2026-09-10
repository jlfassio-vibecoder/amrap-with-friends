-- designate_benchmark: the clock and the domain must be the same fact.
--
-- 20260909230000 validated p_duration_minutes and p_time_domain independently,
-- so a 25-minute test could be filed against the 5-minute slot with every CHECK
-- passing. Unreachable from this client, which always derives the domain from
-- the cap — but this function is the integrity floor, and its whole purpose is
-- to hold whatever the client does. A mismatched pair holds the wrong slot
-- permanently and nothing downstream can tell.
--
-- Otherwise unchanged from 20260909230000.

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
  v_expected_domain int;
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

  -- The clock and the domain have to be the same fact, and until now they were
  -- validated separately: a 25-minute test could be filed against the 5-minute
  -- slot with both CHECK constraints passing. Unreachable from this client,
  -- which always derives the domain from the cap — but this function is the
  -- integrity floor, and a mismatched pair would hold the wrong slot
  -- permanently with nothing downstream able to notice.
  --
  -- Ranges mirror timeDomains.ts and are pinned by benchmarkCap.contract.test.ts.
  v_expected_domain := CASE
    WHEN p_duration_minutes BETWEEN 3 AND 5 THEN 5
    WHEN p_duration_minutes BETWEEN 7 AND 10 THEN 10
    WHEN p_duration_minutes BETWEEN 12 AND 15 THEN 15
    WHEN p_duration_minutes BETWEEN 18 AND 25 THEN 20
    ELSE NULL
  END;

  IF v_expected_domain IS NULL OR v_expected_domain <> p_time_domain THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'domain_mismatch');
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
