-- Phase 2 sub-phase 2: publish coach workouts to regular users, and
-- surface workout history both to the coach (who ran it, how they
-- scored) and to the athlete (resolve a session's coach-workout name in
-- My Sessions).
--
-- Publishing is a separate action from editing (coach_set_workout_status)
-- rather than a field on coach_upsert_workout, since it's a distinct
-- lifecycle step a coach should be able to flip without resubmitting the
-- whole form. list_published_coach_workouts is intentionally NOT gated by
-- is_coach() — any signed-in user may browse and start a published WOD,
-- same as the built-in library templates.

ALTER TABLE public.coach_workouts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

ALTER TABLE public.coach_workouts
  DROP CONSTRAINT IF EXISTS coach_workouts_status_check;

ALTER TABLE public.coach_workouts
  ADD CONSTRAINT coach_workouts_status_check CHECK (status IN ('draft', 'published'));

CREATE INDEX IF NOT EXISTS coach_workouts_published_idx
  ON public.coach_workouts (updated_at DESC)
  WHERE status = 'published';

-- coach_upsert_workout: add 'status' to the returned jsonb (new workouts
-- default to 'draft' via the column default; edits leave status alone).
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
      'status', v_row.status,
      'isLocked', public.coach_workout_is_locked(v_row.id),
      'createdAt', v_row.created_at,
      'updatedAt', v_row.updated_at
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_upsert_workout(uuid, text, text, int, int, jsonb, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_upsert_workout(uuid, text, text, int, int, jsonb, text[], text) TO authenticated;

CREATE OR REPLACE FUNCTION public.coach_set_workout_status(p_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_row public.coach_workouts%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_status NOT IN ('draft', 'published') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE public.coach_workouts
  SET status = p_status, updated_at = now()
  WHERE id = p_id AND created_by = v_uid
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workout not found';
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
      'isLocked', public.coach_workout_is_locked(v_row.id),
      'createdAt', v_row.created_at,
      'updatedAt', v_row.updated_at
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_set_workout_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_set_workout_status(uuid, text) TO authenticated;

-- Add status to the existing coach-facing list/get RPCs.

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
        'status', cw.status,
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

-- Athlete-facing: browse published workouts. Movements come back with
-- linked coach-exercise detail inlined (instructions/cues/tips/image),
-- since a regular user can't call coach_list_exercises to resolve them.
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
                    'imagePath', ce.image_path
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

-- Coach-facing: who has run this workout, and how did they score.
CREATE OR REPLACE FUNCTION public.coach_workout_history(p_id uuid)
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

  IF NOT EXISTS (
    SELECT 1 FROM public.coach_workouts WHERE id = p_id AND created_by = v_uid
  ) THEN
    RAISE EXCEPTION 'Workout not found';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'sessions', (
      SELECT coalesce(jsonb_agg(s ORDER BY s.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          se.id AS session_id,
          p.nickname,
          p.role,
          se.state,
          psr.final_score,
          se.created_at
        FROM public.sessions se
        INNER JOIN public.participants p ON p.session_id = se.id
        LEFT JOIN public.participant_segment_results psr
          ON psr.participant_id = p.id AND psr.segment_index = se.segment_index
        WHERE se.template_id = 'coach:' || p_id::text
      ) s
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_workout_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_workout_history(uuid) TO authenticated;

-- Athlete-facing: resolve a coach workout's current name for My Sessions,
-- so a session shows "Crimp Conditioning" instead of a raw template_id.
CREATE OR REPLACE FUNCTION public.my_sessions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_sessions jsonb;
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
        'session_id', s.id,
        'created_at', s.created_at,
        'duration_minutes', s.duration_minutes,
        'workout', s.workout,
        'state', s.state,
        'segment_index', s.segment_index,
        'round_count', (
          SELECT count(*)::int
          FROM public.rounds r
          WHERE r.participant_id = p.id AND r.segment_index = s.segment_index
        ),
        'partial_reps', coalesce(psr.partial_reps, 0),
        'final_score', psr.final_score,
        'score_breakdown', psr.score_breakdown,
        'coach_workout_name', cw.name
      )
      ORDER BY p.joined_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_sessions
  FROM public.participants p
  INNER JOIN public.sessions s ON s.id = p.session_id
  LEFT JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
    AND psr.segment_index = s.segment_index
  LEFT JOIN public.coach_workouts cw
    ON s.template_id = 'coach:' || cw.id::text
  WHERE p.user_id = v_uid;

  RETURN jsonb_build_object('ok', true, 'sessions', v_sessions);
END;
$$;
