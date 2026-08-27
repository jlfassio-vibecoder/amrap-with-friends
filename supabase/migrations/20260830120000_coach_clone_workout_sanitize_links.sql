-- When cloning a shared workout, drop movement links to exercises the
-- cloner cannot access (not owned and not shared), matching the
-- coach_upsert_workout ownership/shared check.

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
  v_movements jsonb;
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
  WHERE id = p_id AND (created_by = v_uid OR is_shared = true);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workout not found';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      CASE
        WHEN (m ->> 'coachExerciseId') IS NULL OR btrim(m ->> 'coachExerciseId') = '' THEN m
        WHEN EXISTS (
          SELECT 1
          FROM public.coach_exercises ce
          WHERE ce.id = (m ->> 'coachExerciseId')::uuid
            AND (ce.created_by = v_uid OR ce.is_shared = true)
        ) THEN m
        ELSE (m - 'coachExerciseId')
      END
      ORDER BY ord
    ),
    '[]'::jsonb
  )
  INTO v_movements
  FROM jsonb_array_elements(v_source.movements) WITH ORDINALITY AS t(m, ord);

  INSERT INTO public.coach_workouts (
    created_by, name, focus, duration_minutes, intensity_tier, movements, tags, notes
  )
  VALUES (
    v_uid,
    left(v_source.name || ' (Copy)', 120),
    v_source.focus,
    v_source.duration_minutes,
    v_source.intensity_tier,
    v_movements,
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
      'status', v_row.status,
      'isShared', v_row.is_shared,
      'isOwner', true,
      'isLocked', false,
      'createdAt', v_row.created_at,
      'updatedAt', v_row.updated_at
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_clone_workout(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_clone_workout(uuid) TO authenticated;
