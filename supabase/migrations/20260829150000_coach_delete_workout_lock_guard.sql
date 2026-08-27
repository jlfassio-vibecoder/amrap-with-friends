-- Reject deleting a coach workout that is locked by a finished session,
-- matching the lock rule introduced in 20260829130000_coach_wod_lock_and_clone.sql.

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

  IF NOT EXISTS (
    SELECT 1
    FROM public.coach_workouts
    WHERE id = p_id AND created_by = v_uid
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF public.coach_workout_is_locked(p_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'locked');
  END IF;

  DELETE FROM public.coach_workouts WHERE id = p_id AND created_by = v_uid;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_delete_workout(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_delete_workout(uuid) TO authenticated;
