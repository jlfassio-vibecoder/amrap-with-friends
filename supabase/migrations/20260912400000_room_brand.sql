-- A room's brand, and the one place a coach can change what their share cards
-- look like.
--
-- `rooms.brand` has existed since the boundary migration and has never been
-- writable. This adds the write path and puts the brand on the one read the
-- share card makes.
--
-- Shape: {"accent": "#rrggbb"}. One colour, deliberately. The card's
-- background and ink are what keep it legible in a group chat at thumbnail
-- size; the accent is the one that carries meaning. The readable pairing is
-- derived client-side in src/lib/rooms/brand.ts -- an accent that cannot be
-- read on the card is lifted toward legibility rather than rejected, so a gym
-- whose colour is navy still gets a navy card.
--
-- Branding is the owner's, not a co-host's. A co-host runs missions; the room's
-- identity is not theirs to change.

CREATE OR REPLACE FUNCTION public.set_room_brand(p_room_id uuid, p_accent text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_accent text := lower(btrim(coalesce(p_accent, '')));
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  IF public.room_role(p_room_id, v_uid) IS DISTINCT FROM 'owner' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  -- Clearing is the same decision as changing, so it is the same control.
  IF v_accent = '' THEN
    UPDATE public.rooms SET brand = brand - 'accent' WHERE id = p_room_id;
    RETURN jsonb_build_object('ok', true, 'brand', jsonb_build_object());
  END IF;

  -- Validated here as well as in the client: this is a value that ends up
  -- inside a Canvas fill style, and the only trustworthy check is the one the
  -- database makes.
  IF v_accent !~ '^#[0-9a-f]{6}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_accent');
  END IF;

  UPDATE public.rooms
  SET brand = coalesce(brand, '{}'::jsonb) || jsonb_build_object('accent', v_accent)
  WHERE id = p_room_id;

  RETURN jsonb_build_object('ok', true, 'brand', jsonb_build_object('accent', v_accent));
END;
$$;

REVOKE ALL ON FUNCTION public.set_room_brand(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_room_brand(uuid, text) TO authenticated;

-- The share card asks this once, when the athlete finishes. Adding the brand
-- here rather than making a second call keeps the card on one round trip --
-- and this RPC already answers for guests, who are exactly the people most
-- likely to post the card.
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
      'brand', v_room.brand,
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
