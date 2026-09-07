-- The same-variant ghost: race your best run of the version you are about to do.
--
-- Phase 2 stopped a modified run from being returned as the personal best,
-- because a scaled score handed back as a target on the programmed movement is
-- one the athlete cannot reach. That was right, and it left an athlete who
-- always scales with no ghost at all — correctly excluded from the wrong target,
-- given nothing in exchange.
--
-- Now that a scaling has a name and can be chosen before the mission starts,
-- the like-for-like comparison exists: the athlete's best previous run of the
-- exact same version. That is the pacing curve worth racing, and the one that
-- shows progression.
--
-- personal_best is UNCHANGED and still standard-only. variant_best is additive,
-- returned only when the caller names a version. Both can come back, and the
-- athlete picks — their own standard best is not a target to hide from them,
-- it is just not the default when they have said they are scaling.
--
-- The campaign pacer (friends) is untouched, for the reason recorded in
-- 20260909120000: it races live teammates, not a stored best.


-- The exact version performed, as a matchable key.
--
-- Mirrors src/lib/mission/movementVersion.ts, and
-- movementVersion.contract.test.ts runs both over the same inputs on every CI
-- run. A disagreement here does not raise — the ghost simply never matches and
-- nothing says why — so the contract test is the only thing standing between a
-- drifted key and a feature that silently does nothing.
--
-- COLLATE "C" is deliberate: byte order on UTF-8 is code-point order, which is
-- what the TypeScript side sorts by. The database's own collation must not
-- decide whether a ghost matches.
CREATE OR REPLACE FUNCTION public.movement_version_key(
  p_modified_movements text[],
  p_movement_variants jsonb
)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 PARALLEL SAFE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT coalesce(
    string_agg(
      name || '#' || coalesce(p_movement_variants ->> name, ''),
      '|' ORDER BY name COLLATE "C"
    ),
    ''
  )
  FROM (
    SELECT DISTINCT name
    FROM (
      SELECT unnest(coalesce(p_modified_movements, ARRAY[]::text[])) AS name
      UNION ALL
      SELECT jsonb_object_keys(coalesce(p_movement_variants, '{}'::jsonb)) AS name
    ) named
  ) distinct_names;
$function$;

REVOKE EXECUTE ON FUNCTION public.movement_version_key(text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.movement_version_key(text[], jsonb) TO authenticated;


-- available_ghosts gains p_version_key and returns variant_best alongside.

CREATE OR REPLACE FUNCTION public.available_ghosts(
  p_template_id text,
  p_duration_minutes integer,
  p_for_mission_id uuid,
  p_version_key text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_template_id text;
  v_version_key text;
  v_personal_best jsonb;
  v_variant_best jsonb;
  v_friends jsonb := '[]'::jsonb;
  v_live_mission_id uuid;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_template_id := trim(p_template_id);
  IF v_template_id IS NULL OR v_template_id = '' OR length(v_template_id) > 120 THEN
    RAISE EXCEPTION 'Invalid template id';
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes < 1 OR p_duration_minutes > 60 THEN
    RAISE EXCEPTION 'Duration must be between 1 and 60 minutes';
  END IF;

  -- An empty key means "as programmed", which personal_best already covers;
  -- treat it as no request rather than as a second standard-only query.
  v_version_key := nullif(coalesce(p_version_key, ''), '');
  IF v_version_key IS NOT NULL AND length(v_version_key) > 2000 THEN
    RAISE EXCEPTION 'Invalid version key';
  END IF;

  SELECT jsonb_build_object(
    'mission_id', s.id,
    'participant_id', p.id,
    'nickname', p.nickname,
    'final_score', psr.final_score,
    'base_score', (
      (
        SELECT count(*)::int
        FROM public.rounds r
        WHERE r.participant_id = p.id
          AND r.segment_index = s.segment_index
      ) * public.compute_reps_per_round(s.workout)
      + psr.partial_reps
    ),
    'created_at', s.created_at
  )
  INTO v_personal_best
  FROM public.participants p
  INNER JOIN public.missions s ON s.id = p.mission_id
  INNER JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
    AND psr.segment_index = s.segment_index
  WHERE p.user_id = v_uid
    AND s.template_id = v_template_id
    AND s.duration_minutes = p_duration_minutes
    -- Standard runs only: a modified run is history, not a target.
    AND coalesce(cardinality(psr.modified_movements), 0) = 0
    AND psr.final_score IS NOT NULL
    AND psr.score_breakdown IS NOT NULL
  ORDER BY psr.final_score DESC, s.created_at DESC
  LIMIT 1;

  IF v_version_key IS NOT NULL THEN
    SELECT jsonb_build_object(
      'mission_id', s.id,
      'participant_id', p.id,
      'nickname', p.nickname,
      'final_score', psr.final_score,
      'base_score', (
        (
          SELECT count(*)::int
          FROM public.rounds r
          WHERE r.participant_id = p.id
            AND r.segment_index = s.segment_index
        ) * public.compute_reps_per_round(s.workout)
        + psr.partial_reps
      ),
      'created_at', s.created_at
    )
    INTO v_variant_best
    FROM public.participants p
    INNER JOIN public.missions s ON s.id = p.mission_id
    INNER JOIN public.participant_segment_results psr
      ON psr.participant_id = p.id
      AND psr.segment_index = s.segment_index
    WHERE p.user_id = v_uid
      AND s.template_id = v_template_id
      AND s.duration_minutes = p_duration_minutes
      -- The whole modification state must match, not just the movement asked
      -- about. Scaling the push-ups and scaling the squats instead are two
      -- different workouts, and a ghost built from the wrong one paces wrong.
      AND public.movement_version_key(psr.modified_movements, psr.movement_variants) = v_version_key
      AND psr.final_score IS NOT NULL
      AND psr.score_breakdown IS NOT NULL
    ORDER BY psr.final_score DESC, s.created_at DESC
    LIMIT 1;
  END IF;

  IF p_for_mission_id IS NOT NULL THEN
    SELECT o.mission_id
    INTO v_live_mission_id
    FROM public.campaign_makeups mk
    INNER JOIN public.campaign_occurrences o ON o.id = mk.occurrence_id
    INNER JOIN public.campaign_members req
      ON req.campaign_id = o.campaign_id
     AND req.user_id = v_uid
     AND req.status = 'active'
    WHERE mk.mission_id = p_for_mission_id
      AND mk.user_id = v_uid;

    IF v_live_mission_id IS NOT NULL THEN
      SELECT coalesce(
        jsonb_agg(run.ref ORDER BY run.final_score DESC, run.created_at DESC),
        '[]'::jsonb
      )
      INTO v_friends
      FROM (
        SELECT
          jsonb_build_object(
            'mission_id', s.id,
            'participant_id', p.id,
            'nickname', p.nickname,
            'final_score', psr.final_score,
            'base_score', (
              (
                SELECT count(*)::int
                FROM public.rounds r
                WHERE r.participant_id = p.id
                  AND r.segment_index = s.segment_index
              ) * public.compute_reps_per_round(s.workout)
              + psr.partial_reps
            ),
            'created_at', s.created_at
          ) AS ref,
          psr.final_score,
          s.created_at
        FROM public.participants p
        INNER JOIN public.missions s ON s.id = p.mission_id
        INNER JOIN public.participant_segment_results psr
          ON psr.participant_id = p.id
         AND psr.segment_index = s.segment_index
        INNER JOIN public.campaign_occurrences o
          ON o.mission_id = s.id
        INNER JOIN public.campaign_members own
          ON own.campaign_id = o.campaign_id
         AND own.user_id = p.user_id
         AND own.status = 'active'
        WHERE s.id = v_live_mission_id
          AND p.user_id IS DISTINCT FROM v_uid
          AND psr.final_score IS NOT NULL
      ) run;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'personal_best', v_personal_best,
    'variant_best', v_variant_best,
    'friends', coalesce(v_friends, '[]'::jsonb)
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.available_ghosts(text, int, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.available_ghosts(text, int, uuid, text) TO authenticated;


-- Existing arities keep working: an older client asks for no version and gets
-- exactly what it got before, plus a null variant_best it will ignore.

CREATE OR REPLACE FUNCTION public.available_ghosts(
  p_template_id text,
  p_duration_minutes integer,
  p_for_mission_id uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
BEGIN
  RETURN public.available_ghosts(p_template_id, p_duration_minutes, p_for_mission_id, NULL);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.available_ghosts(text, int, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.available_ghosts(text, int, uuid) TO authenticated;
