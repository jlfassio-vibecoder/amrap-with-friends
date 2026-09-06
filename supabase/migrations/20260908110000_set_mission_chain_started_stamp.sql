-- Allow the Create launch path to stamp position 0 with the mission just
-- created by create_rally_point_mission, so Phase 4's start_next_chained_mission
-- does not recreate mission 1.

CREATE OR REPLACE FUNCTION public.set_mission_chain(
  p_rally_point_id uuid,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $function$
DECLARE
  v_uid uuid;
  v_rally_point public.rally_points%ROWTYPE;
  v_item jsonb;
  v_position int := 0;
  v_duration int;
  v_tier int;
  v_template text;
  v_started int;
  v_started_mission_id uuid;
  v_stamp_count int := 0;
  v_mission public.missions%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_rally_point_id IS NULL THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  SELECT * INTO v_rally_point
  FROM public.rally_points
  WHERE id = p_rally_point_id
  FOR UPDATE;

  IF NOT FOUND OR v_rally_point.status <> 'open' THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  IF v_rally_point.host_user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Only the host can set the mission chain';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Items must be an array';
  END IF;

  IF jsonb_array_length(p_items) > 5 THEN
    RAISE EXCEPTION 'A chain holds at most 5 missions';
  END IF;

  -- An item that has already launched is history. Rewriting the queue must not
  -- silently delete the record of a mission the squad actually ran.
  SELECT count(*)::int INTO v_started
  FROM public.mission_chain_items
  WHERE rally_point_id = p_rally_point_id
    AND started_mission_id IS NOT NULL;

  IF v_started > 0 THEN
    RAISE EXCEPTION 'Cannot rewrite a chain that has already started';
  END IF;

  DELETE FROM public.mission_chain_items
  WHERE rally_point_id = p_rally_point_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_duration := (v_item->>'duration_minutes')::int;

    IF NOT public.validate_workout(v_item->'workout') THEN
      RAISE EXCEPTION 'Invalid workout format at position %', v_position;
    END IF;

    -- Raises for a minute no domain claims, which is how an illegal cap is
    -- rejected without restating the range table here.
    PERFORM public.chain_rest_seconds(v_duration, NULL);

    v_tier := NULL;
    IF v_item ? 'intensity_tier' AND jsonb_typeof(v_item->'intensity_tier') = 'number' THEN
      v_tier := (v_item->>'intensity_tier')::int;
      IF v_tier < 1 OR v_tier > 5 THEN
        RAISE EXCEPTION 'Intensity tier must be between 1 and 5';
      END IF;
    END IF;

    v_template := NULL;
    IF v_item ? 'template_id' AND jsonb_typeof(v_item->'template_id') = 'string' THEN
      v_template := trim(v_item->>'template_id');
      IF v_template = '' OR length(v_template) > 120 THEN
        RAISE EXCEPTION 'Invalid template id at position %', v_position;
      END IF;
    END IF;

    v_started_mission_id := NULL;
    IF v_item ? 'started_mission_id'
      AND jsonb_typeof(v_item->'started_mission_id') = 'string'
      AND length(trim(v_item->>'started_mission_id')) > 0
    THEN
      IF v_position <> 0 THEN
        RAISE EXCEPTION 'started_mission_id is only allowed on position 0';
      END IF;

      BEGIN
        v_started_mission_id := (trim(v_item->>'started_mission_id'))::uuid;
      EXCEPTION
        WHEN invalid_text_representation THEN
          RAISE EXCEPTION 'Invalid started_mission_id';
      END;

      SELECT * INTO v_mission
      FROM public.missions
      WHERE id = v_started_mission_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'started_mission_id does not match a mission';
      END IF;

      IF v_mission.rally_point_id IS DISTINCT FROM p_rally_point_id THEN
        RAISE EXCEPTION 'started_mission_id does not belong to this rally point';
      END IF;

      IF v_rally_point.active_mission_id IS DISTINCT FROM v_started_mission_id THEN
        RAISE EXCEPTION 'started_mission_id must be the rally point active mission';
      END IF;

      v_stamp_count := v_stamp_count + 1;
    END IF;

    INSERT INTO public.mission_chain_items
      (
        rally_point_id,
        position,
        duration_minutes,
        workout,
        template_id,
        intensity_tier,
        started_mission_id
      )
    VALUES
      (
        p_rally_point_id,
        v_position,
        v_duration,
        v_item->'workout',
        v_template,
        v_tier,
        v_started_mission_id
      );

    v_position := v_position + 1;
  END LOOP;

  IF v_stamp_count > 1 THEN
    RAISE EXCEPTION 'At most one started_mission_id is allowed';
  END IF;

  RETURN jsonb_build_object('ok', true, 'count', v_position);
END;
$function$;
