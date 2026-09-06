-- Serialise chained advances on the hub row.
--
-- `SELECT ... WHERE started_mission_id IS NULL ORDER BY position LIMIT 1 FOR
-- UPDATE` does not re-scan after the lock is released, so two concurrent
-- advances could leave the second one believing the chain was complete while
-- items remained. Locking the rally point first makes the second advance wait
-- and then read the queue fresh.
--
-- Function body is otherwise unchanged from 20260908100000.

CREATE OR REPLACE FUNCTION public.start_next_chained_mission(p_rally_point_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $function$
DECLARE
  v_uid uuid;
  v_item public.mission_chain_items%ROWTYPE;
  v_previous public.mission_chain_items%ROWTYPE;
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
  --
  -- Without this, two concurrent advances race on the item SELECT below. In
  -- READ COMMITTED the second transaction blocks on the row lock, and when it
  -- is released Postgres re-evaluates the predicate against the updated row;
  -- started_mission_id is now set so the row no longer matches, and because
  -- LIMIT 1 has already been applied the query returns zero rows rather than
  -- moving on to the next item. The caller is told 'chain_complete' and the
  -- client clears a queue that still has missions in it.
  --
  -- Taking the rally point lock first means the second transaction waits here
  -- and then reads the queue fresh. start_next_rally_point_mission locks the
  -- same row, so this does not add a lock ordering the code did not already
  -- have.
  PERFORM 1 FROM public.rally_points WHERE id = p_rally_point_id FOR UPDATE;

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
