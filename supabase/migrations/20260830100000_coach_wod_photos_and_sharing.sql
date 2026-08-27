-- Phase 2 sub-phase 3: multi-photo exercises and a shared-library toggle,
-- plus (client-only, no schema change) exercise-name autocomplete and
-- movement reordering.
--
-- Photos: coach_exercises.image_path (single path) is replaced by
-- coach_exercises.photos (jsonb array of {path, caption?}), backfilled
-- from the old column then dropped. coach_upsert_exercise's signature
-- changes (image_path -> photos), so the old overload is dropped first
-- per the established convention.
--
-- Sharing: is_shared on both coach_exercises and coach_workouts lets a
-- coach opt a record into visibility for every other coach (read + link +
-- clone), while edits/deletes remain owner-only. This means
-- coach_upsert_workout's "do I own every linked exercise" check must
-- broaden to "own OR shared", and coach_delete_exercise's in-use check
-- must broaden from "my workouts" to "any coach's workouts" since a
-- shared exercise can now be linked from someone else's workout.

ALTER TABLE public.coach_exercises
  ADD COLUMN IF NOT EXISTS photos jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.coach_exercises
SET photos = jsonb_build_array(jsonb_build_object('path', image_path))
WHERE image_path IS NOT NULL AND photos = '[]'::jsonb;

ALTER TABLE public.coach_exercises DROP COLUMN IF EXISTS image_path;

ALTER TABLE public.coach_exercises
  ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false;

ALTER TABLE public.coach_workouts
  ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS coach_exercises_shared_idx
  ON public.coach_exercises (is_shared) WHERE is_shared = true;

CREATE INDEX IF NOT EXISTS coach_workouts_shared_idx
  ON public.coach_workouts (is_shared) WHERE is_shared = true;

CREATE OR REPLACE FUNCTION public.validate_coach_exercise_photos(p_photos jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_len int;
  v_elem jsonb;
  v_path text;
  v_caption text;
  i int;
BEGIN
  IF p_photos IS NULL OR jsonb_typeof(p_photos) <> 'array' THEN
    RETURN false;
  END IF;

  v_len := jsonb_array_length(p_photos);
  IF v_len > 6 THEN
    RETURN false;
  END IF;

  FOR i IN 0..(v_len - 1) LOOP
    v_elem := p_photos -> i;
    IF jsonb_typeof(v_elem) <> 'object' THEN
      RETURN false;
    END IF;

    v_path := v_elem ->> 'path';
    IF v_path IS NULL OR btrim(v_path) = '' OR length(v_path) > 500 THEN
      RETURN false;
    END IF;

    IF v_elem ? 'caption' AND length(coalesce(v_elem ->> 'caption', '')) > 140 THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_coach_exercise_photos(jsonb) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.coach_upsert_exercise(uuid, text, text[], text[], text, text);

CREATE OR REPLACE FUNCTION public.coach_upsert_exercise(
  p_id uuid,
  p_name text,
  p_instructions text[],
  p_cues text[],
  p_tips text,
  p_photos jsonb,
  p_is_shared boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_name text;
  v_photos jsonb;
  v_row public.coach_exercises%ROWTYPE;
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
    RAISE EXCEPTION 'Exercise name must be 1-120 characters';
  END IF;
  IF p_tips IS NOT NULL AND length(p_tips) > 280 THEN
    RAISE EXCEPTION 'Tips must be 280 characters or fewer';
  END IF;

  v_photos := coalesce(p_photos, '[]'::jsonb);
  IF NOT public.validate_coach_exercise_photos(v_photos) THEN
    RAISE EXCEPTION 'Invalid photo list — up to 6 photos, each with a path';
  END IF;

  IF p_id IS NOT NULL THEN
    UPDATE public.coach_exercises
    SET
      name = v_name,
      instructions = coalesce(p_instructions, '{}'),
      cues = coalesce(p_cues, '{}'),
      tips = p_tips,
      photos = v_photos,
      is_shared = coalesce(p_is_shared, false),
      updated_at = now()
    WHERE id = p_id AND created_by = v_uid
    RETURNING * INTO v_row;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Exercise not found';
    END IF;
  ELSE
    INSERT INTO public.coach_exercises (created_by, name, instructions, cues, tips, photos, is_shared)
    VALUES (v_uid, v_name, coalesce(p_instructions, '{}'), coalesce(p_cues, '{}'), p_tips, v_photos, coalesce(p_is_shared, false))
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'exercise', jsonb_build_object(
      'id', v_row.id,
      'name', v_row.name,
      'instructions', to_jsonb(v_row.instructions),
      'cues', to_jsonb(v_row.cues),
      'tips', v_row.tips,
      'photos', v_row.photos,
      'isShared', v_row.is_shared,
      'isOwner', true,
      'createdAt', v_row.created_at,
      'updatedAt', v_row.updated_at
    )
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'You already have an exercise named "%"', v_name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_upsert_exercise(uuid, text, text[], text[], text, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_upsert_exercise(uuid, text, text[], text[], text, jsonb, boolean) TO authenticated;

-- Broaden the in-use check: a shared exercise can now be linked from any
-- coach's workout, not just the caller's own.
CREATE OR REPLACE FUNCTION public.coach_delete_exercise(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_in_use boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.coach_workouts w, jsonb_array_elements(w.movements) m
    WHERE (m ->> 'coachExerciseId') = p_id::text
  ) INTO v_in_use;

  IF v_in_use THEN
    RAISE EXCEPTION 'Exercise is used by a workout — remove it from that workout first';
  END IF;

  DELETE FROM public.coach_exercises WHERE id = p_id AND created_by = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_delete_exercise(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_delete_exercise(uuid) TO authenticated;

-- Broaden visibility: a coach's own exercises plus everyone's shared ones.
CREATE OR REPLACE FUNCTION public.coach_list_exercises(p_search text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_search text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_search := nullif(btrim(coalesce(p_search, '')), '');

  RETURN jsonb_build_object(
    'ok', true,
    'exercises', (
      SELECT coalesce(jsonb_agg(e ORDER BY e.name_lower), '[]'::jsonb)
      FROM (
        SELECT
          ce.id,
          ce.name,
          lower(ce.name) AS name_lower,
          to_jsonb(ce.instructions) AS instructions,
          to_jsonb(ce.cues) AS cues,
          ce.tips,
          ce.photos,
          ce.is_shared AS "isShared",
          (ce.created_by = v_uid) AS "isOwner",
          ce.created_at AS "createdAt",
          ce.updated_at AS "updatedAt"
        FROM public.coach_exercises ce
        WHERE (ce.created_by = v_uid OR ce.is_shared = true)
          AND (v_search IS NULL OR ce.name ILIKE '%' || v_search || '%')
      ) e
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_list_exercises(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_list_exercises(text) TO authenticated;

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
  WHERE id = p_id AND (created_by = v_uid OR is_shared = true);

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

  INSERT INTO public.coach_exercises (created_by, name, instructions, cues, tips, photos)
  VALUES (v_uid, v_name, v_source.instructions, v_source.cues, v_source.tips, v_source.photos)
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'exercise', jsonb_build_object(
      'id', v_row.id,
      'name', v_row.name,
      'instructions', to_jsonb(v_row.instructions),
      'cues', to_jsonb(v_row.cues),
      'tips', v_row.tips,
      'photos', v_row.photos,
      'isShared', v_row.is_shared,
      'isOwner', true,
      'createdAt', v_row.created_at,
      'updatedAt', v_row.updated_at
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_clone_exercise(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_clone_exercise(uuid) TO authenticated;

-- coach_workouts: add is_shared to upsert/list/get/clone, and broaden the
-- linked-exercise ownership check in upsert to accept shared exercises.

DROP FUNCTION IF EXISTS public.coach_upsert_workout(uuid, text, text, int, int, jsonb, text[], text);

CREATE OR REPLACE FUNCTION public.coach_upsert_workout(
  p_id uuid,
  p_name text,
  p_focus text,
  p_duration_minutes int,
  p_intensity_tier int,
  p_movements jsonb,
  p_tags text[],
  p_notes text,
  p_is_shared boolean DEFAULT false
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
  -- exercise this coach owns, or one shared by another coach.
  SELECT m ->> 'coachExerciseId'
  INTO v_bad_exercise_id
  FROM jsonb_array_elements(p_movements) m
  WHERE (m ->> 'coachExerciseId') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.coach_exercises ce
      WHERE ce.id = (m ->> 'coachExerciseId')::uuid
        AND (ce.created_by = v_uid OR ce.is_shared = true)
    )
  LIMIT 1;

  IF v_bad_exercise_id IS NOT NULL THEN
    RAISE EXCEPTION 'Movement references an exercise you do not have access to';
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
      is_shared = coalesce(p_is_shared, false),
      updated_at = now()
    WHERE id = p_id AND created_by = v_uid
    RETURNING * INTO v_row;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Workout not found';
    END IF;
  ELSE
    INSERT INTO public.coach_workouts (
      created_by, name, focus, duration_minutes, intensity_tier, movements, tags, notes, is_shared
    )
    VALUES (v_uid, v_name, p_focus, p_duration_minutes, p_intensity_tier, p_movements, v_tags, p_notes, coalesce(p_is_shared, false))
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
      'status', v_row.status,
      'isShared', v_row.is_shared,
      'isOwner', true,
      'isLocked', public.coach_workout_is_locked(v_row.id),
      'createdAt', v_row.created_at,
      'updatedAt', v_row.updated_at
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_upsert_workout(uuid, text, text, int, int, jsonb, text[], text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_upsert_workout(uuid, text, text, int, int, jsonb, text[], text, boolean) TO authenticated;

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
          cw.status,
          cw.is_shared AS "isShared",
          (cw.created_by = v_uid) AS "isOwner",
          public.coach_workout_is_locked(cw.id) AS "isLocked",
          cw.updated_at
        FROM public.coach_workouts cw
        WHERE (cw.created_by = v_uid OR cw.is_shared = true)
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
        'status', cw.status,
        'isShared', cw.is_shared,
        'isOwner', (cw.created_by = v_uid),
        'isLocked', public.coach_workout_is_locked(cw.id),
        'createdAt', cw.created_at,
        'updatedAt', cw.updated_at
      )
      FROM public.coach_workouts cw
      WHERE cw.id = p_id AND (cw.created_by = v_uid OR cw.is_shared = true)
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_get_workout(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_get_workout(uuid) TO authenticated;

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
  WHERE id = p_id AND (created_by = v_uid OR is_shared = true);

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

-- Athlete-facing published list: swap the single imagePath for the photos
-- array on each linked exercise.
CREATE OR REPLACE FUNCTION public.list_published_coach_workouts(
  p_search text DEFAULT NULL,
  p_tag text DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_search text;
  v_tag text;
  v_limit int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_search := nullif(btrim(coalesce(p_search, '')), '');
  v_tag := nullif(btrim(coalesce(p_tag, '')), '');
  v_limit := LEAST(GREATEST(coalesce(p_limit, 50), 1), 100);

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
          cw.notes,
          cw.updated_at,
          (
            SELECT coalesce(jsonb_agg(
              jsonb_build_object(
                'name', m ->> 'name',
                'target', CASE WHEN m ? 'target' THEN (m ->> 'target')::numeric ELSE NULL END,
                'unit', m ->> 'unit',
                'coachExerciseId', m ->> 'coachExerciseId',
                'exercise', (
                  SELECT jsonb_build_object(
                    'id', ce.id,
                    'name', ce.name,
                    'instructions', to_jsonb(ce.instructions),
                    'cues', to_jsonb(ce.cues),
                    'tips', ce.tips,
                    'photos', ce.photos
                  )
                  FROM public.coach_exercises ce
                  WHERE (m ? 'coachExerciseId') AND ce.id = (m ->> 'coachExerciseId')::uuid
                )
              )
            ), '[]'::jsonb)
            FROM jsonb_array_elements(cw.movements) m
          ) AS movements
        FROM public.coach_workouts cw
        WHERE cw.status = 'published'
          AND (v_search IS NULL OR cw.name ILIKE '%' || v_search || '%')
          AND (v_tag IS NULL OR v_tag = ANY (cw.tags))
        ORDER BY cw.updated_at DESC
        LIMIT v_limit
      ) w
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_published_coach_workouts(text, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_published_coach_workouts(text, text, int) TO authenticated;
