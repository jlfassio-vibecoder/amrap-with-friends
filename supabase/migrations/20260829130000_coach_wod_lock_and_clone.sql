-- Phase 2 sub-phase 1: lock a coach workout once it has a completed
-- session, and add clone RPCs as the escape hatch for iterating on a
-- locked workout (also doubles as "duplicate" for both workouts and
-- exercises).
--
-- Lock is computed dynamically from sessions.template_id rather than a
-- stored flag, so it can never drift out of sync: a workout is locked
-- the moment any session with template_id = 'coach:<id>' reaches
-- state = 'finished'. This anticipates the phase-2 "publish" work (not
-- yet built) where sessions.template_id gets set to that value; today no
-- session can reference a coach workout yet, so nothing is locked until
-- that phase ships — this migration just makes the rule ready ahead of it.

CREATE OR REPLACE FUNCTION public.coach_workout_is_locked(p_workout_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sessions se
    WHERE se.template_id = 'coach:' || p_workout_id::text
      AND se.state = 'finished'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.coach_workout_is_locked(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.coach_upsert_workout(
  p_id uuid,
  p_name text,
  p_focus text,
  p_duration_minutes int,
  p_intensity_tier int,
  p_movements jsonb,
  p_tags text[],
  p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_name text;
  v_tags text[];
  v_bad_exercise_id text;
  v_row public.coach_workouts%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_name := trim(both from coalesce(p_name, ''));
  IF v_name = '' OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'Workout name must be 1-120 characters';
  END IF;
  IF p_duration_minutes IS NULL OR p_duration_minutes < 1 OR p_duration_minutes > 90 THEN
    RAISE EXCEPTION 'Duration must be between 1 and 90 minutes';
  END IF;
  IF p_intensity_tier IS NULL OR p_intensity_tier < 1 OR p_intensity_tier > 5 THEN
    RAISE EXCEPTION 'Intensity must be between 1 and 5';
  END IF;
  IF NOT public.validate_coach_workout_movements(p_movements) THEN
    RAISE EXCEPTION 'Invalid movement list';
  END IF;

  -- Any movement that links to a coachExerciseId must reference an
  -- exercise this coach actually owns.
  SELECT m ->> 'coachExerciseId'
  INTO v_bad_exercise_id
  FROM jsonb_array_elements(p_movements) m
  WHERE (m ->> 'coachExerciseId') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.coach_exercises ce
      WHERE ce.id = (m ->> 'coachExerciseId')::uuid AND ce.created_by = v_uid
    )
  LIMIT 1;

  IF v_bad_exercise_id IS NOT NULL THEN
    RAISE EXCEPTION 'Movement references an exercise you do not own';
  END IF;

  v_tags := (
    SELECT coalesce(array_agg(DISTINCT btrim(t)), '{}')
    FROM unnest(coalesce(p_tags, '{}')) t
    WHERE btrim(t) <> ''
  );

  IF p_id IS NOT NULL THEN
    IF public.coach_workout_is_locked(p_id) THEN
      RAISE EXCEPTION 'Workout is locked — it has a completed session. Clone it to make changes.';
    END IF;

    UPDATE public.coach_workouts
    SET
      name = v_name,
      focus = p_focus,
      duration_minutes = p_duration_minutes,
      intensity_tier = p_intensity_tier,
      movements = p_movements,
      tags = v_tags,
      notes = p_notes,
      updated_at = now()
    WHERE id = p_id AND created_by = v_uid
    RETURNING * INTO v_row;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Workout not found';
    END IF;
  ELSE
    INSERT INTO public.coach_workouts (
      created_by, name, focus, duration_minutes, intensity_tier, movements, tags, notes
    )
    VALUES (v_uid, v_name, p_focus, p_duration_minutes, p_intensity_tier, p_movements, v_tags, p_notes)
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'workout', jsonb_build_object(
      'id', v_row.id,
      'name', v_row.name,
      'focus', v_row.focus,
      'durationMinutes', v_row.duration_minutes,
      'intensityTier', v_row.intensity_tier,
      'movements', v_row.movements,
      'tags', to_jsonb(v_row.tags),
      'notes', v_row.notes,
      'isLocked', public.coach_workout_is_locked(v_row.id),
      'createdAt', v_row.created_at,
      'updatedAt', v_row.updated_at
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_upsert_workout(uuid, text, text, int, int, jsonb, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_upsert_workout(uuid, text, text, int, int, jsonb, text[], text) TO authenticated;

CREATE OR REPLACE FUNCTION public.coach_list_workouts(
  p_search text DEFAULT NULL,
  p_tag text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_search text;
  v_tag text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_search := nullif(btrim(coalesce(p_search, '')), '');
  v_tag := nullif(btrim(coalesce(p_tag, '')), '');

  RETURN jsonb_build_object(
    'ok', true,
    'workouts', (
      SELECT coalesce(jsonb_agg(w ORDER BY w.updated_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          cw.id,
          cw.name,
          cw.focus,
          cw.duration_minutes AS "durationMinutes",
          cw.intensity_tier AS "intensityTier",
          to_jsonb(cw.tags) AS tags,
          jsonb_array_length(cw.movements) AS "movementCount",
          public.coach_workout_is_locked(cw.id) AS "isLocked",
          cw.updated_at
        FROM public.coach_workouts cw
        WHERE cw.created_by = v_uid
          AND (v_search IS NULL OR cw.name ILIKE '%' || v_search || '%')
          AND (v_tag IS NULL OR v_tag = ANY (cw.tags))
      ) w
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_list_workouts(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_list_workouts(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.coach_get_workout(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'workout', (
      SELECT jsonb_build_object(
        'id', cw.id,
        'name', cw.name,
        'focus', cw.focus,
        'durationMinutes', cw.duration_minutes,
        'intensityTier', cw.intensity_tier,
        'movements', cw.movements,
        'tags', to_jsonb(cw.tags),
        'notes', cw.notes,
        'isLocked', public.coach_workout_is_locked(cw.id),
        'createdAt', cw.created_at,
        'updatedAt', cw.updated_at
      )
      FROM public.coach_workouts cw
      WHERE cw.id = p_id AND cw.created_by = v_uid
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_get_workout(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_get_workout(uuid) TO authenticated;

-- Clone RPCs: the escape hatch for editing a locked workout, and
-- double as "duplicate" for both workouts and exercises.

CREATE OR REPLACE FUNCTION public.coach_clone_workout(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_source public.coach_workouts%ROWTYPE;
  v_row public.coach_workouts%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_source
  FROM public.coach_workouts
  WHERE id = p_id AND created_by = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workout not found';
  END IF;

  INSERT INTO public.coach_workouts (
    created_by, name, focus, duration_minutes, intensity_tier, movements, tags, notes
  )
  VALUES (
    v_uid,
    left(v_source.name || ' (Copy)', 120),
    v_source.focus,
    v_source.duration_minutes,
    v_source.intensity_tier,
    v_source.movements,
    v_source.tags,
    v_source.notes
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'workout', jsonb_build_object(
      'id', v_row.id,
      'name', v_row.name,
      'focus', v_row.focus,
      'durationMinutes', v_row.duration_minutes,
      'intensityTier', v_row.intensity_tier,
      'movements', v_row.movements,
      'tags', to_jsonb(v_row.tags),
      'notes', v_row.notes,
      'isLocked', false,
      'createdAt', v_row.created_at,
      'updatedAt', v_row.updated_at
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_clone_workout(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_clone_workout(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.coach_clone_exercise(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_source public.coach_exercises%ROWTYPE;
  v_row public.coach_exercises%ROWTYPE;
  v_name text;
  v_suffix int := 1;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_source
  FROM public.coach_exercises
  WHERE id = p_id AND created_by = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exercise not found';
  END IF;

  v_name := left(v_source.name || ' (Copy)', 120);
  WHILE EXISTS (
    SELECT 1 FROM public.coach_exercises
    WHERE created_by = v_uid AND lower(name) = lower(v_name)
  ) LOOP
    v_suffix := v_suffix + 1;
    v_name := left(v_source.name || ' (Copy ' || v_suffix || ')', 120);
  END LOOP;

  INSERT INTO public.coach_exercises (created_by, name, instructions, cues, tips, image_path)
  VALUES (v_uid, v_name, v_source.instructions, v_source.cues, v_source.tips, v_source.image_path)
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'exercise', jsonb_build_object(
      'id', v_row.id,
      'name', v_row.name,
      'instructions', to_jsonb(v_row.instructions),
      'cues', to_jsonb(v_row.cues),
      'tips', v_row.tips,
      'imagePath', v_row.image_path,
      'createdAt', v_row.created_at,
      'updatedAt', v_row.updated_at
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_clone_exercise(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_clone_exercise(uuid) TO authenticated;
