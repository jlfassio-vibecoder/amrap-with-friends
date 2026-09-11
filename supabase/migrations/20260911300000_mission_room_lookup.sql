-- What room, if any, a mission belongs to.
--
-- The post-finish sheet needs this once, at the moment someone finishes, so it
-- is its own small RPC rather than another field on get_mission_live_state --
-- which every client pulls on a timer, and whose payload is already the thing
-- that scales worst with roster size (measured in #167).
--
-- Answers for anyone, signed in or not: a guest is exactly who this is for.
-- `is_member` is false for a guest, because membership needs an account.

CREATE OR REPLACE FUNCTION public.get_mission_room(p_mission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_room public.rooms%ROWTYPE;
BEGIN
  IF p_mission_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'room', NULL);
  END IF;

  SELECT r.* INTO v_room
  FROM public.missions m
  JOIN public.rooms r ON r.id = m.room_id
  WHERE m.id = p_mission_id;

  IF NOT FOUND THEN
    -- A personal mission has no room. Not an error; most missions are this.
    RETURN jsonb_build_object('ok', true, 'room', NULL);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'room', jsonb_build_object(
      'id', v_room.id,
      'handle', v_room.handle,
      'display_name', v_room.display_name,
      'is_member', v_uid IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.room_members
        WHERE room_id = v_room.id AND user_id = v_uid AND left_at IS NULL
      ),
      -- Whether this athlete already has a home coach, so the sheet can say
      -- what joining will and will not change instead of implying it moves.
      'has_home_coach', v_uid IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.athlete_home_coach WHERE user_id = v_uid
      )
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_mission_room(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_mission_room(uuid) TO anon, authenticated;
