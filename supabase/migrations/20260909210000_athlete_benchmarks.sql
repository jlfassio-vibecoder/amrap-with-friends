-- Benchmarks an athlete designates for themselves.
--
-- A benchmark is a workout the athlete has said they are measuring against and
-- will run again. See docs/plans/personal-benchmarks.md.
--
-- Stored, not derived — and that is not a contradiction of the campaign rule.
-- Campaign roles are derived because the schedule already encodes them: the
-- benchmark is the only workout kept out of the build rotation, so the role can
-- always be recovered and can never drift. A personal designation has no
-- schedule to read it out of; nothing but the athlete's intent separates "I am
-- testing myself on this" from "I did this workout". Put the fact where it
-- actually lives.
--
-- Attempts are NOT stored. An attempt is any scored participant_segment_results
-- row with the same template, the same clock and the same movement_version_key
-- for that user, which is a comparison movement_version_key already defines and
-- movementVersion.contract.test.ts already pins across both languages. No join
-- table, nothing to keep in step.
--
-- A designation changes no score, PVI, domain weight, training load, intensity
-- tier or classification progress. Same rule as modified_movements, same
-- reason: the moment designating moves a number, people designate for the
-- number rather than for the measurement.

CREATE TABLE IF NOT EXISTS public.athlete_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- Library template ids only; see the coach-workout guard in designate_benchmark.
  template_id text NOT NULL,
  duration_minutes int NOT NULL,
  -- domainForCap(duration_minutes). Stored rather than computed so the partial
  -- unique index below can enforce one benchmark per domain.
  time_domain int NOT NULL,
  -- '' means "as programmed"; otherwise a movement_version_key.
  version_key text NOT NULL DEFAULT '',
  designated_at timestamptz NOT NULL DEFAULT now(),
  -- Retiring frees the slot and keeps the history. There is no un-retire and no
  -- delete: a benchmark you can erase when the number goes the wrong way is not
  -- a benchmark. Same reasoning as refusing to unmark a modified movement.
  retired_at timestamptz NULL,
  CONSTRAINT athlete_benchmarks_template_length CHECK (
    length(template_id) > 0 AND length(template_id) <= 120
  ),
  -- Legal library caps only, matching timeDomains.ts ranges.
  CONSTRAINT athlete_benchmarks_duration_range CHECK (
    duration_minutes BETWEEN 3 AND 5
    OR duration_minutes BETWEEN 7 AND 10
    OR duration_minutes BETWEEN 12 AND 15
    OR duration_minutes BETWEEN 18 AND 25
  ),
  CONSTRAINT athlete_benchmarks_domain_valid CHECK (time_domain IN (5, 10, 15, 20)),
  CONSTRAINT athlete_benchmarks_version_key_length CHECK (length(version_key) <= 2000)
);

-- One live benchmark per domain, enforced where it cannot be raced by two
-- concurrent designates. The three-at-once cap is a count check inside the RPC,
-- in the same transaction as the insert.
CREATE UNIQUE INDEX IF NOT EXISTS athlete_benchmarks_one_active_per_domain
  ON public.athlete_benchmarks (user_id, time_domain)
  WHERE retired_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_athlete_benchmarks_user
  ON public.athlete_benchmarks (user_id, retired_at);

ALTER TABLE public.athlete_benchmarks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.athlete_benchmarks FROM PUBLIC, anon, authenticated;


-- ---------------------------------------------------------------------------
-- The integrity floor.
--
-- This enforces what must hold whatever the client does: one personal
-- benchmark per domain, three personal at most, library templates only.
--
-- It deliberately does NOT know about campaign benchmarks. A campaign
-- benchmark counts against the athlete's three, but recovering one means
-- re-implementing deriveCampaignRoles — which is not "the first occurrence": it
-- also requires the schedule to end by repeating its opening workout, and bails
-- when there are more repeats than any campaign length schedules. A second copy
-- of that rule in plpgsql would drift the first time either changed, and would
-- drift silently, since the only symptom is a cap that admits one benchmark too
-- many. So the campaign contribution is applied in campaignBenchmarkSlots.ts,
-- over data the client already holds. Over-designating costs the athlete
-- training, not integrity, which is the right thing to enforce in the cheaper
-- place.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.designate_benchmark(
  p_template_id text,
  p_duration_minutes int,
  p_time_domain int,
  p_version_key text DEFAULT ''
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
      user_id, template_id, duration_minutes, time_domain, version_key
    )
    VALUES (
      v_uid, v_template, p_duration_minutes, p_time_domain, left(coalesce(p_version_key, ''), 2000)
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
      'designated_at', v_row.designated_at,
      'retired_at', v_row.retired_at
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.designate_benchmark(text, int, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.designate_benchmark(text, int, int, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.retire_benchmark(p_benchmark_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $function$
DECLARE
  v_uid uuid;
  v_updated int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Scoped to the caller's own row, and only one that is still live, so
  -- retiring is idempotent-ish rather than able to rewrite retired_at later.
  UPDATE public.athlete_benchmarks
  SET retired_at = now()
  WHERE id = p_benchmark_id AND user_id = v_uid AND retired_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.retire_benchmark(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retire_benchmark(uuid) TO authenticated;


-- Retired benchmarks come back too: they keep their history and the athlete can
-- still read what they scored. Only the active ones hold a slot.
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
