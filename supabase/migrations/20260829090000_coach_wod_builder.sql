-- Coach WOD Builder (phase A): schema + RPCs + storage for a coach's own
-- exercise library and custom workouts ("Coach Workouts"). Phase 1 scope
-- per plan: authoring/reference library in the Coach area only — not yet
-- wired into CreateSessionPage. Every RPC follows the existing coach_*
-- convention: SECURITY DEFINER, explicit auth.uid()/is_coach() checks,
-- REVOKE FROM PUBLIC/anon, GRANT TO authenticated.

CREATE TABLE IF NOT EXISTS public.coach_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  instructions text[] NOT NULL DEFAULT '{}',
  cues text[] NOT NULL DEFAULT '{}',
  tips text,
  image_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coach_exercises_name_length CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  CONSTRAINT coach_exercises_tips_length CHECK (tips IS NULL OR length(tips) <= 280)
);

CREATE UNIQUE INDEX IF NOT EXISTS coach_exercises_owner_name_idx
  ON public.coach_exercises (created_by, lower(name));

ALTER TABLE public.coach_exercises ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coach_exercises FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.coach_workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  focus text,
  duration_minutes int NOT NULL,
  intensity_tier int NOT NULL DEFAULT 3,
  movements jsonb NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coach_workouts_name_length CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  CONSTRAINT coach_workouts_focus_length CHECK (focus IS NULL OR length(focus) <= 200),
  CONSTRAINT coach_workouts_notes_length CHECK (notes IS NULL OR length(notes) <= 1000),
  CONSTRAINT coach_workouts_duration_range CHECK (duration_minutes BETWEEN 1 AND 90),
  CONSTRAINT coach_workouts_intensity_range CHECK (intensity_tier BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS coach_workouts_created_by_idx
  ON public.coach_workouts (created_by, updated_at DESC);

CREATE INDEX IF NOT EXISTS coach_workouts_tags_idx
  ON public.coach_workouts USING gin (tags);

ALTER TABLE public.coach_workouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coach_workouts FROM PUBLIC, anon, authenticated;

-- Pure shape validation for coach_workouts.movements, mirroring
-- validate_workout()'s conventions but also allowing an optional
-- coachExerciseId link. Ownership of that id is checked by the calling
-- RPC (needs a table lookup, so it can't live in this IMMUTABLE function).
CREATE OR REPLACE FUNCTION public.validate_coach_workout_movements(p_movements jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_len int;
  v_elem jsonb;
  v_name text;
  v_target numeric;
  i int;
BEGIN
  IF p_movements IS NULL OR jsonb_typeof(p_movements) <> 'array' THEN
    RETURN false;
  END IF;

  v_len := jsonb_array_length(p_movements);
  IF v_len < 1 OR v_len > 30 THEN
    RETURN false;
  END IF;

  FOR i IN 0..(v_len - 1) LOOP
    v_elem := p_movements -> i;
    IF jsonb_typeof(v_elem) <> 'object' THEN
      RETURN false;
    END IF;

    v_name := trim(both from v_elem ->> 'name');
    IF v_name IS NULL OR v_name = '' OR length(v_name) > 120 THEN
      RETURN false;
    END IF;

    IF v_elem ? 'target' THEN
      BEGIN
        v_target := (v_elem ->> 'target')::numeric;
      EXCEPTION
        WHEN OTHERS THEN
          RETURN false;
      END;
      IF v_target IS NULL OR v_target <= 0 OR v_target <> trunc(v_target) THEN
        RETURN false;
      END IF;
    END IF;

    IF v_elem ? 'unit' AND length(coalesce(v_elem ->> 'unit', '')) > 32 THEN
      RETURN false;
    END IF;

    IF v_elem ? 'coachExerciseId' AND v_elem -> 'coachExerciseId' IS NOT NULL THEN
      BEGIN
        PERFORM (v_elem ->> 'coachExerciseId')::uuid;
      EXCEPTION
        WHEN OTHERS THEN
          RETURN false;
      END;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_coach_workout_movements(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.coach_upsert_exercise(
  p_id uuid,
  p_name text,
  p_instructions text[],
  p_cues text[],
  p_tips text,
  p_image_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_name text;
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

  IF p_id IS NOT NULL THEN
    UPDATE public.coach_exercises
    SET
      name = v_name,
      instructions = coalesce(p_instructions, '{}'),
      cues = coalesce(p_cues, '{}'),
      tips = p_tips,
      image_path = p_image_path,
      updated_at = now()
    WHERE id = p_id AND created_by = v_uid
    RETURNING * INTO v_row;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Exercise not found';
    END IF;
  ELSE
    INSERT INTO public.coach_exercises (created_by, name, instructions, cues, tips, image_path)
    VALUES (v_uid, v_name, coalesce(p_instructions, '{}'), coalesce(p_cues, '{}'), p_tips, p_image_path)
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
      'imagePath', v_row.image_path,
      'createdAt', v_row.created_at,
      'updatedAt', v_row.updated_at
    )
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'You already have an exercise named "%"', v_name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_upsert_exercise(uuid, text, text[], text[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_upsert_exercise(uuid, text, text[], text[], text, text) TO authenticated;

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
    WHERE w.created_by = v_uid
      AND (m ->> 'coachExerciseId') = p_id::text
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
          ce.image_path AS "imagePath",
          ce.created_at AS "createdAt",
          ce.updated_at AS "updatedAt"
        FROM public.coach_exercises ce
        WHERE ce.created_by = v_uid
          AND (v_search IS NULL OR ce.name ILIKE '%' || v_search || '%')
      ) e
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_list_exercises(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_list_exercises(text) TO authenticated;

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
      'createdAt', v_row.created_at,
      'updatedAt', v_row.updated_at
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_upsert_workout(uuid, text, text, int, int, jsonb, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_upsert_workout(uuid, text, text, int, int, jsonb, text[], text) TO authenticated;

CREATE OR REPLACE FUNCTION public.coach_delete_workout(p_id uuid)
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

  DELETE FROM public.coach_workouts WHERE id = p_id AND created_by = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_delete_workout(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_delete_workout(uuid) TO authenticated;

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

-- Storage: coach-only exercise image uploads. This is the first
-- client-side Storage write path in the app (the static exercise-media
-- bucket is only ever written by service-role scripts), so bucket +
-- policies are created here rather than out-of-band.
INSERT INTO storage.buckets (id, name, public)
VALUES ('coach-exercise-media', 'coach-exercise-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY coach_exercise_media_select ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'coach-exercise-media');

CREATE POLICY coach_exercise_media_insert ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'coach-exercise-media' AND public.is_coach());

CREATE POLICY coach_exercise_media_update ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'coach-exercise-media' AND public.is_coach())
  WITH CHECK (bucket_id = 'coach-exercise-media' AND public.is_coach());

CREATE POLICY coach_exercise_media_delete ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'coach-exercise-media' AND public.is_coach());
