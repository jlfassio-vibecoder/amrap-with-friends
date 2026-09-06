-- Mission chains: an ordered queue of missions planned before the first Start,
-- with an automatic rest between them.
--
-- The rest is not a new timer. `missions.rally_point_countdown_ends_at` already
-- exists and the rally point already renders T-MINUS from it, so a chained
-- mission is simply created with that column pre-armed. The host's existing
-- abort control is the "skip the rest" button.

-- ---------------------------------------------------------------------------
-- The rest table.
--
-- This mirrors restAfterMissionSec in src/lib/mission/chainRest.ts, which the
-- builder uses to preview the same numbers. Two copies of one rule is exactly
-- the drift this codebase has paid for before, so chainRest.contract.test.ts
-- generates the CASE arms below from the TypeScript and fails CI if they stop
-- agreeing. Edit both, or edit neither.
--
-- Base by time domain, then +60s for a tier 4-5 mission and -30s for a tier
-- 1-2 one, clamped to [60, 600]. The ceiling is set_rally_point_countdown's own
-- limit, so this function cannot return a rest the timer will refuse to arm.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.chain_rest_seconds(
  p_duration_minutes int,
  p_intensity_tier int
)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_base int;
  v_adjust int;
BEGIN
  v_base := CASE
    WHEN p_duration_minutes BETWEEN 3 AND 5 THEN 90
    WHEN p_duration_minutes BETWEEN 7 AND 10 THEN 150
    WHEN p_duration_minutes BETWEEN 12 AND 15 THEN 210
    WHEN p_duration_minutes BETWEEN 18 AND 25 THEN 300
    ELSE NULL
  END;

  -- A chain runs library workouts at legal caps. A minute no domain claims is a
  -- programming error, not something to paper over with a guess.
  IF v_base IS NULL THEN
    RAISE EXCEPTION 'No time domain for a %-minute mission; chains only run library caps.',
      p_duration_minutes;
  END IF;

  v_adjust := CASE
    WHEN p_intensity_tier IS NULL THEN 0
    WHEN p_intensity_tier >= 4 THEN 60
    WHEN p_intensity_tier <= 2 THEN -30
    ELSE 0
  END;

  RETURN least(greatest(v_base + v_adjust, 60), 600);
END;
$function$;

-- ---------------------------------------------------------------------------
-- The queue.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mission_chain_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rally_point_id uuid NOT NULL REFERENCES public.rally_points (id) ON DELETE CASCADE,
  -- 0-based. Rest is derived from the item at position - 1.
  position int NOT NULL,
  duration_minutes int NOT NULL,
  workout jsonb NOT NULL,
  template_id text,
  intensity_tier int,
  -- Set when this item is launched. A mission id rather than a boolean, so the
  -- chain is a record of what actually ran instead of a checklist that forgets.
  started_mission_id uuid REFERENCES public.missions (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mission_chain_items_position_range CHECK (position BETWEEN 0 AND 4),
  CONSTRAINT mission_chain_items_duration_range CHECK (duration_minutes BETWEEN 1 AND 60),
  CONSTRAINT mission_chain_items_intensity_range CHECK (
    intensity_tier IS NULL OR intensity_tier BETWEEN 1 AND 5
  ),
  CONSTRAINT mission_chain_items_template_length CHECK (
    template_id IS NULL OR (length(template_id) > 0 AND length(template_id) <= 120)
  ),
  CONSTRAINT mission_chain_items_unique_position UNIQUE (rally_point_id, position)
);

CREATE INDEX IF NOT EXISTS idx_mission_chain_items_rally_point
  ON public.mission_chain_items (rally_point_id, position);

ALTER TABLE public.mission_chain_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mission_chain_items FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Replace the whole queue in one transaction.
--
-- Whole-queue replacement rather than per-row edits because that is how the
-- builder works: the host reorders locally and saves once. It also means a
-- reorder cannot half-apply and leave two items sharing a position.
-- ---------------------------------------------------------------------------
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

    INSERT INTO public.mission_chain_items
      (rally_point_id, position, duration_minutes, workout, template_id, intensity_tier)
    VALUES
      (p_rally_point_id, v_position, v_duration, v_item->'workout', v_template, v_tier);

    v_position := v_position + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'count', v_position);
END;
$function$;

-- ---------------------------------------------------------------------------
-- Read the queue back. Tables are revoked, so this is the only way in.
-- Members can read it, not just the host: the squad should be able to see what
-- they signed up for.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_mission_chain(p_rally_point_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $function$
DECLARE
  v_uid uuid;
  v_is_member boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.rally_points l
    WHERE l.id = p_rally_point_id
      AND (
        l.host_user_id = v_uid
        OR EXISTS (
          SELECT 1 FROM public.rally_point_members m
          WHERE m.rally_point_id = l.id
            AND m.user_id = v_uid
            AND m.status = 'active'
        )
      )
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'items', coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', c.id,
            'position', c.position,
            'duration_minutes', c.duration_minutes,
            'workout', c.workout,
            'template_id', c.template_id,
            'intensity_tier', c.intensity_tier,
            'started_mission_id', c.started_mission_id
          )
          ORDER BY c.position
        )
        FROM public.mission_chain_items c
        WHERE c.rally_point_id = p_rally_point_id
      ),
      '[]'::jsonb
    )
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- Launch the next queued mission with its rest already counting down.
--
-- Wraps start_next_rally_point_mission rather than reimplementing it, so the
-- host check, the active-mission limit and the participant seeding stay in one
-- place. The nested call runs in this transaction and sees the same auth.uid().
-- ---------------------------------------------------------------------------
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

REVOKE EXECUTE ON FUNCTION public.chain_rest_seconds(int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chain_rest_seconds(int, int) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_mission_chain(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_mission_chain(uuid, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_mission_chain(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_mission_chain(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.start_next_chained_mission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_next_chained_mission(uuid) TO authenticated;
