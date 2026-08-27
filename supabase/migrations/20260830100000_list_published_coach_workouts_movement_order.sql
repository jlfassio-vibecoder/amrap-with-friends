-- Preserve published workout movement order (jsonb_agg without ORDER BY
-- is non-deterministic). Follow-up to 20260830090000_coach_wod_publish_and_history.sql.

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
