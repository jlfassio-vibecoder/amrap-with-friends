-- Heal a missing position-0 started_mission_id before advance.
--
-- Create stamps pos0 after create_rally_point_mission. If that stamp is
-- missing, My Missions used to fall back and still show a chain while
-- start_next_chained_mission treated pos0 as the next unstarted item and
-- recreated workout 1. Stamp the hub's active mission onto pos0 when it
-- belongs to this hub and is not already used on another chain row.

CREATE OR REPLACE FUNCTION public.start_next_chained_mission(p_rally_point_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $function$
DECLARE
  v_uid uuid;
  v_item public.mission_chain_items%ROWTYPE;
  v_pos0 public.mission_chain_items%ROWTYPE;
  v_previous public.mission_chain_items%ROWTYPE;
  v_active_mission_id uuid;
  v_result jsonb;
  v_mission_id uuid;
  v_rest int := 0;
  v_ends_at timestamptz := NULL;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Serialise advances on the hub row before reading the queue.
  PERFORM 1 FROM public.rally_points WHERE id = p_rally_point_id FOR UPDATE;

  SELECT * INTO v_pos0
  FROM public.mission_chain_items
  WHERE rally_point_id = p_rally_point_id
    AND position = 0
  FOR UPDATE;

  IF FOUND AND v_pos0.started_mission_id IS NULL THEN
    SELECT rp.active_mission_id INTO v_active_mission_id
    FROM public.rally_points rp
    WHERE rp.id = p_rally_point_id;

    IF v_active_mission_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.missions m
        WHERE m.id = v_active_mission_id
          AND m.rally_point_id = p_rally_point_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.mission_chain_items c
        WHERE c.rally_point_id = p_rally_point_id
          AND c.started_mission_id = v_active_mission_id
      )
    THEN
      UPDATE public.mission_chain_items
      SET started_mission_id = v_active_mission_id
      WHERE id = v_pos0.id;
    END IF;
  END IF;

  SELECT * INTO v_item
  FROM public.mission_chain_items
  WHERE rally_point_id = p_rally_point_id
    AND started_mission_id IS NULL
  ORDER BY position ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'chain_complete');
  END IF;

  -- Rest is earned by the mission before this one, so the first item has none.
  IF v_item.position > 0 THEN
    SELECT * INTO v_previous
    FROM public.mission_chain_items
    WHERE rally_point_id = p_rally_point_id
      AND position = v_item.position - 1;

    IF FOUND THEN
      v_rest := public.chain_rest_seconds(
        v_previous.duration_minutes,
        v_previous.intensity_tier
      );
    END IF;
  END IF;

  v_result := public.start_next_rally_point_mission(
    p_rally_point_id,
    v_item.duration_minutes,
    v_item.workout,
    v_item.template_id,
    v_item.intensity_tier
  );

  IF coalesce((v_result->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN v_result;
  END IF;

  v_mission_id := (v_result->>'mission_id')::uuid;

  -- Arming the countdown here is the whole trick: the rally point renders it as
  -- T-MINUS with no new UI, and the existing abort control skips it.
  IF v_rest > 0 THEN
    v_ends_at := now() + (v_rest * interval '1 second');
    UPDATE public.missions
    SET rally_point_countdown_ends_at = v_ends_at
    WHERE id = v_mission_id;
  END IF;

  UPDATE public.mission_chain_items
  SET started_mission_id = v_mission_id
  WHERE id = v_item.id;

  RETURN v_result
    || jsonb_build_object(
      'chain_item_id', v_item.id,
      'chain_position', v_item.position,
      'rest_seconds', v_rest,
      'rest_ends_at', v_ends_at,
      'chain_remaining', (
        SELECT count(*)::int
        FROM public.mission_chain_items
        WHERE rally_point_id = p_rally_point_id
          AND started_mission_id IS NULL
      )
    );
END;
$function$;
