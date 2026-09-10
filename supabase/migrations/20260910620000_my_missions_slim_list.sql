-- Slim my_missions list payload (D1) and embed chain summaries (D2).
-- Drop full workout / score_breakdown from every row; hydrate via my_mission_detail.
-- list_unlocked_amqap replaces fetchMyMissions for HUD AMQAP repair.

-- ---------------------------------------------------------------------------
-- reps_per_round from workout jsonb — mirrors computeRepsPerRound.ts
-- Returns NULL when empty or not Phase-1 scorable (round-based score line).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.workout_reps_per_round(p_workout jsonb)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_ex jsonb;
  v_target numeric;
  v_unit text;
  v_total int := 0;
BEGIN
  IF p_workout IS NULL OR jsonb_typeof(p_workout) <> 'array' OR jsonb_array_length(p_workout) = 0 THEN
    RETURN NULL;
  END IF;

  FOR v_ex IN SELECT value FROM jsonb_array_elements(p_workout)
  LOOP
    IF jsonb_typeof(v_ex) <> 'object' THEN
      RETURN NULL;
    END IF;

    IF NOT (v_ex ? 'target') THEN
      RETURN NULL;
    END IF;

    BEGIN
      v_target := (v_ex ->> 'target')::numeric;
    EXCEPTION WHEN others THEN
      RETURN NULL;
    END;

    IF v_target IS NULL OR v_target <> trunc(v_target) OR v_target <= 0 THEN
      RETURN NULL;
    END IF;

    v_unit := v_ex ->> 'unit';
    IF v_unit IS NOT NULL AND v_unit <> 'reps' AND v_unit <> 'sec' THEN
      RETURN NULL;
    END IF;

    v_total := v_total + v_target::int;
  END LOOP;

  RETURN v_total;
END;
$function$;

REVOKE ALL ON FUNCTION public.workout_reps_per_round(jsonb) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- my_missions — slim rows + embedded chains
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_missions()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_missions jsonb;
  v_chains jsonb;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'participant_id', p.id,
        'nickname', p.nickname,
        'joined_at', p.joined_at,
        'role', p.role,
        'mission_id', s.id,
        'created_at', s.created_at,
        'scheduled_at', s.scheduled_at,
        'is_featured', coalesce(s.is_featured, false),
        'duration_minutes', s.duration_minutes,
        'template_id', s.template_id,
        'rally_point_id', s.rally_point_id,
        'movement_count', coalesce(jsonb_array_length(s.workout), 0),
        'reps_per_round', public.workout_reps_per_round(s.workout),
        'has_score_breakdown', psr.score_breakdown IS NOT NULL,
        'state', s.state,
        'segment_index', s.segment_index,
        'round_count', (
          SELECT count(*)::int
          FROM public.rounds r
          WHERE r.participant_id = p.id AND r.segment_index = s.segment_index
        ),
        'partial_reps', coalesce(psr.partial_reps, 0),
        'final_score', psr.final_score,
        'modified_movements', psr.modified_movements,
        'movement_variants', psr.movement_variants,
        'rpe', psr.rpe,
        'session_notes', psr.session_notes,
        'check_ins', psr.check_ins,
        'coach_workout_name', cw.name
      )
      ORDER BY coalesce(s.scheduled_at, s.created_at) DESC
    ),
    '[]'::jsonb
  )
  INTO v_missions
  FROM public.participants p
  INNER JOIN public.missions s ON s.id = p.mission_id
  LEFT JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
    AND psr.segment_index = s.segment_index
  LEFT JOIN public.coach_workouts cw
    ON s.template_id = 'coach:' || cw.id::text
  WHERE p.user_id = v_uid
    AND NOT (
      coalesce(s.is_featured, false)
      AND s.state = 'finished'
      AND psr.score_breakdown IS NULL
    );

  -- Chains for hubs the athlete appears on that hold ≥2 planned slots.
  -- Workout jsonb only for queued (unstarted) slots.
  SELECT coalesce(
    jsonb_object_agg(sub.rally_point_id::text, sub.items),
    '{}'::jsonb
  )
  INTO v_chains
  FROM (
    SELECT
      c.rally_point_id,
      jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'position', c.position,
          'duration_minutes', c.duration_minutes,
          'template_id', c.template_id,
          'intensity_tier', c.intensity_tier,
          'started_mission_id', c.started_mission_id,
          'workout', CASE
            WHEN c.started_mission_id IS NULL THEN c.workout
            ELSE '[]'::jsonb
          END
        )
        ORDER BY c.position
      ) AS items
    FROM public.mission_chain_items c
    WHERE c.rally_point_id IN (
      SELECT DISTINCT s.rally_point_id
      FROM public.participants p
      INNER JOIN public.missions s ON s.id = p.mission_id
      WHERE p.user_id = v_uid
        AND s.rally_point_id IS NOT NULL
    )
    GROUP BY c.rally_point_id
    HAVING count(*) >= 2
  ) sub;

  RETURN jsonb_build_object(
    'ok', true,
    'missions', v_missions,
    'chains', v_chains
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.my_missions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_missions() TO authenticated;

-- ---------------------------------------------------------------------------
-- my_mission_detail — workout + score_breakdown on demand
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_mission_detail(p_mission_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_row record;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT
    s.id AS mission_id,
    s.workout,
    psr.score_breakdown
  INTO v_row
  FROM public.participants p
  INNER JOIN public.missions s ON s.id = p.mission_id
  LEFT JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
    AND psr.segment_index = s.segment_index
  WHERE p.user_id = v_uid
    AND s.id = p_mission_id
  LIMIT 1;

  IF v_row.mission_id IS NULL THEN
    RAISE EXCEPTION 'Mission not found';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'mission_id', v_row.mission_id,
    'workout', coalesce(v_row.workout, '[]'::jsonb),
    'score_breakdown', v_row.score_breakdown
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.my_mission_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_mission_detail(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- list_unlocked_amqap — HUD repair without full my_missions history
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_unlocked_amqap()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_missions jsonb;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'mission_id', s.id,
        'participant_id', p.id,
        'segment_index', s.segment_index,
        'template_id', s.template_id,
        'state', s.state
      )
    ),
    '[]'::jsonb
  )
  INTO v_missions
  FROM public.participants p
  INNER JOIN public.missions s ON s.id = p.mission_id
  LEFT JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
    AND psr.segment_index = s.segment_index
  WHERE p.user_id = v_uid
    AND s.state = 'finished'
    AND s.template_id LIKE 'amqap-%'
    AND psr.score_breakdown IS NULL;

  RETURN jsonb_build_object('ok', true, 'missions', v_missions);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.list_unlocked_amqap() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_unlocked_amqap() TO authenticated;
