-- coach_list_workouts returned updated_at (snake_case) while the client
-- parser requires updatedAt (camelCase), so every summary row was dropped
-- and the Coach Workouts list looked empty despite successful saves.
-- Alias to match coach_list_exercises / upsert/get workout payloads.

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
      SELECT coalesce(jsonb_agg(w ORDER BY w."updatedAt" DESC), '[]'::jsonb)
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
          cw.updated_at AS "updatedAt"
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
