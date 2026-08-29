-- Optional subtitle on coach exercises for alternate names / aka,
-- shown as a sub-heading under the primary exercise name.

ALTER TABLE public.coach_exercises
  ADD COLUMN IF NOT EXISTS subtitle text;

ALTER TABLE public.coach_exercises
  DROP CONSTRAINT IF EXISTS coach_exercises_subtitle_length;

ALTER TABLE public.coach_exercises
  ADD CONSTRAINT coach_exercises_subtitle_length
  CHECK (subtitle IS NULL OR length(subtitle) <= 120);

DROP FUNCTION IF EXISTS public.coach_upsert_exercise(uuid, text, text[], text[], text, jsonb, boolean);

CREATE OR REPLACE FUNCTION public.coach_upsert_exercise(
  p_id uuid,
  p_name text,
  p_instructions text[],
  p_cues text[],
  p_tips text,
  p_photos jsonb,
  p_is_shared boolean DEFAULT false,
  p_subtitle text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_name text;
  v_subtitle text;
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

  v_subtitle := nullif(btrim(coalesce(p_subtitle, '')), '');
  IF v_subtitle IS NOT NULL AND length(v_subtitle) > 120 THEN
    RAISE EXCEPTION 'Subtitle must be 120 characters or fewer';
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
      subtitle = v_subtitle,
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
    INSERT INTO public.coach_exercises (
      created_by, name, subtitle, instructions, cues, tips, photos, is_shared
    )
    VALUES (
      v_uid, v_name, v_subtitle, coalesce(p_instructions, '{}'), coalesce(p_cues, '{}'),
      p_tips, v_photos, coalesce(p_is_shared, false)
    )
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'exercise', jsonb_build_object(
      'id', v_row.id,
      'name', v_row.name,
      'subtitle', v_row.subtitle,
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

REVOKE EXECUTE ON FUNCTION public.coach_upsert_exercise(uuid, text, text[], text[], text, jsonb, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_upsert_exercise(uuid, text, text[], text[], text, jsonb, boolean, text) TO authenticated;

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
          ce.subtitle,
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
          AND (
            v_search IS NULL
            OR ce.name ILIKE '%' || v_search || '%'
            OR coalesce(ce.subtitle, '') ILIKE '%' || v_search || '%'
          )
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

  INSERT INTO public.coach_exercises (
    created_by, name, subtitle, instructions, cues, tips, photos
  )
  VALUES (
    v_uid, v_name, v_source.subtitle, v_source.instructions, v_source.cues,
    v_source.tips, v_source.photos
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'exercise', jsonb_build_object(
      'id', v_row.id,
      'name', v_row.name,
      'subtitle', v_row.subtitle,
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
                    'subtitle', ce.subtitle,
                    'instructions', to_jsonb(ce.instructions),
                    'cues', to_jsonb(ce.cues),
                    'tips', ce.tips,
                    'photos', ce.photos
                  )
                  FROM public.coach_exercises ce
                  WHERE (m ? 'coachExerciseId') AND ce.id = (m ->> 'coachExerciseId')::uuid
                )
              )
              ORDER BY ord
            ), '[]'::jsonb)
            FROM jsonb_array_elements(cw.movements) WITH ORDINALITY AS t(m, ord)
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
