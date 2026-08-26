-- log/update_physical_activity: include activityCategory + activityLabel on
-- the returned entry (list_physical_activity already did; log/update did not).

CREATE OR REPLACE FUNCTION public.log_physical_activity(
  p_activity_type text,
  p_duration_minutes int,
  p_intensity_tier int,
  p_occurred_at timestamptz,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_notes text;
  v_row public.physical_activity_log%ROWTYPE;
  v_cat public.activity_type_catalog%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO v_cat
  FROM public.activity_type_catalog
  WHERE activity_type = p_activity_type;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown activity type';
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes < 1 OR p_duration_minutes > 600 THEN
    RAISE EXCEPTION 'Duration must be between 1 and 600 minutes';
  END IF;

  IF p_intensity_tier IS NULL OR p_intensity_tier < 1 OR p_intensity_tier > 5 THEN
    RAISE EXCEPTION 'Intensity must be between 1 and 5';
  END IF;

  IF p_occurred_at IS NULL OR p_occurred_at > now() + interval '1 day' THEN
    RAISE EXCEPTION 'Activity date cannot be in the future';
  END IF;

  v_notes := nullif(btrim(coalesce(p_notes, '')), '');
  IF v_notes IS NOT NULL AND length(v_notes) > 280 THEN
    RAISE EXCEPTION 'Notes must be 280 characters or fewer';
  END IF;

  INSERT INTO public.physical_activity_log (
    user_id, activity_type, duration_minutes, intensity_tier, occurred_at, notes
  )
  VALUES (v_uid, p_activity_type, p_duration_minutes, p_intensity_tier, p_occurred_at, v_notes)
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'entry', jsonb_build_object(
      'id', v_row.id,
      'activityType', v_row.activity_type,
      'activityCategory', v_cat.activity_category,
      'activityLabel', v_cat.label,
      'durationMinutes', v_row.duration_minutes,
      'intensityTier', v_row.intensity_tier,
      'occurredAt', v_row.occurred_at,
      'notes', v_row.notes,
      'createdAt', v_row.created_at
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_physical_activity(
  p_id uuid,
  p_activity_type text,
  p_duration_minutes int,
  p_intensity_tier int,
  p_occurred_at timestamptz,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_notes text;
  v_row public.physical_activity_log%ROWTYPE;
  v_cat public.activity_type_catalog%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO v_cat
  FROM public.activity_type_catalog
  WHERE activity_type = p_activity_type;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown activity type';
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes < 1 OR p_duration_minutes > 600 THEN
    RAISE EXCEPTION 'Duration must be between 1 and 600 minutes';
  END IF;

  IF p_intensity_tier IS NULL OR p_intensity_tier < 1 OR p_intensity_tier > 5 THEN
    RAISE EXCEPTION 'Intensity must be between 1 and 5';
  END IF;

  IF p_occurred_at IS NULL OR p_occurred_at > now() + interval '1 day' THEN
    RAISE EXCEPTION 'Activity date cannot be in the future';
  END IF;

  v_notes := nullif(btrim(coalesce(p_notes, '')), '');
  IF v_notes IS NOT NULL AND length(v_notes) > 280 THEN
    RAISE EXCEPTION 'Notes must be 280 characters or fewer';
  END IF;

  UPDATE public.physical_activity_log
  SET
    activity_type = p_activity_type,
    duration_minutes = p_duration_minutes,
    intensity_tier = p_intensity_tier,
    occurred_at = p_occurred_at,
    notes = v_notes,
    updated_at = now()
  WHERE id = p_id AND user_id = v_uid
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'entry', jsonb_build_object(
      'id', v_row.id,
      'activityType', v_row.activity_type,
      'activityCategory', v_cat.activity_category,
      'activityLabel', v_cat.label,
      'durationMinutes', v_row.duration_minutes,
      'intensityTier', v_row.intensity_tier,
      'occurredAt', v_row.occurred_at,
      'notes', v_row.notes,
      'createdAt', v_row.created_at
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_physical_activity(text, int, int, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_physical_activity(text, int, int, timestamptz, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_physical_activity(uuid, text, int, int, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_physical_activity(uuid, text, int, int, timestamptz, text) TO authenticated;
