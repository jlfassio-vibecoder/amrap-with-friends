-- Serialize pending-cap check+insert per (sender, recipient) so concurrent
-- assign_workout calls cannot both observe the same count and overshoot the
-- limit. Transaction-scoped advisory lock releases on commit/rollback.

CREATE OR REPLACE FUNCTION public.assign_workout(
  p_to_user_id uuid,
  p_duration_minutes int,
  p_workout jsonb,
  p_template_id text DEFAULT NULL,
  p_intensity_tier int DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_template_id text;
  v_note text;
  v_pending int;
  v_id uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.athlete_profiles WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Intake required';
  END IF;

  IF p_to_user_id IS NULL OR p_to_user_id = v_uid THEN
    RAISE EXCEPTION 'Pick a squad friend to send it to';
  END IF;

  -- Both directions are stored, so this is the whole authorisation check.
  -- Same error whether they are not a friend or do not exist, so this cannot be
  -- used to probe which accounts are real.
  IF NOT EXISTS (
    SELECT 1 FROM public.squad_friends
    WHERE user_id = v_uid AND friend_user_id = p_to_user_id
  ) THEN
    RAISE EXCEPTION 'Pick a squad friend to send it to';
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes < 1 OR p_duration_minutes > 60 THEN
    RAISE EXCEPTION 'Duration must be between 1 and 60 minutes';
  END IF;

  IF NOT public.validate_workout(p_workout) THEN
    RAISE EXCEPTION 'Invalid workout format';
  END IF;

  v_template_id := nullif(btrim(coalesce(p_template_id, '')), '');
  IF v_template_id IS NOT NULL AND length(v_template_id) > 120 THEN
    RAISE EXCEPTION 'Invalid template id';
  END IF;

  IF p_intensity_tier IS NOT NULL AND (p_intensity_tier < 1 OR p_intensity_tier > 5) THEN
    RAISE EXCEPTION 'Intensity tier must be between 1 and 5';
  END IF;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  IF v_note IS NOT NULL AND length(v_note) > 200 THEN
    RAISE EXCEPTION 'Keep the note to 200 characters or fewer';
  END IF;

  -- Hold until commit so count+insert is exclusive for this sender/recipient pair.
  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text), hashtext(p_to_user_id::text));

  SELECT count(*)::int INTO v_pending
  FROM public.assigned_workouts
  WHERE to_user_id = p_to_user_id
    AND from_user_id = v_uid
    AND status = 'pending';

  IF v_pending >= public.assigned_workout_pending_limit() THEN
    RAISE EXCEPTION 'They have not picked up your last few workouts yet';
  END IF;

  INSERT INTO public.assigned_workouts
    (from_user_id, to_user_id, duration_minutes, workout, template_id, intensity_tier, note)
  VALUES
    (v_uid, p_to_user_id, p_duration_minutes, p_workout, v_template_id, p_intensity_tier, v_note)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'assigned_workout_id', v_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_workout(uuid, int, jsonb, text, int, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_workout(uuid, int, jsonb, text, int, text)
  TO authenticated;
