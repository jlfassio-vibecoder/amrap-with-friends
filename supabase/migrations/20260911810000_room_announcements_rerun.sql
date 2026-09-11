-- Re-run of 20260911800000_room_announcements.sql, which was never applied.
--
-- That file lost a version collision. #180 merged
-- 20260911800000_heal_chain_position_zero_match_workout.sql, and its branch had
-- already pushed, so `20260911800000` was recorded in schema_migrations against
-- *that* file. db push then reported "up to date" and skipped mine, because the
-- version was taken. This is the shadowing CLAUDE.md describes, and the fourth
-- time it has happened.
--
-- Caught by checking the database rather than the CLI: schema_migrations held
-- 20260911800000 while room_announcements 404'd and set_room_announcement did
-- not exist. The shadowed file is deleted -- its SQL was byte-identical to what
-- follows, which did run.
--
-- Everything below is idempotent, so it is safe whichever state the database is
-- actually in.

CREATE TABLE IF NOT EXISTS public.room_announcements (
  room_id uuid PRIMARY KEY REFERENCES public.rooms (id) ON DELETE CASCADE,
  body text NOT NULL,
  pinned_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT room_announcements_body_len CHECK (char_length(btrim(body)) BETWEEN 1 AND 500)
);

ALTER TABLE public.room_announcements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.room_announcements FROM PUBLIC, anon, authenticated;

-- Set or clear. Passing null or blank removes it, because "take it down" is the
-- same decision as "change it" and should not need a second control.
CREATE OR REPLACE FUNCTION public.set_room_announcement(p_room_id uuid, p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  -- Co-hosts pin announcements; that is named in the plan as something they do.
  IF coalesce(public.room_role(p_room_id, v_uid), '') NOT IN ('owner', 'cohost') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF v_body = '' THEN
    DELETE FROM public.room_announcements WHERE room_id = p_room_id;
    RETURN jsonb_build_object('ok', true, 'announcement', NULL);
  END IF;

  IF char_length(v_body) > 500 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_long');
  END IF;

  INSERT INTO public.room_announcements (room_id, body, pinned_by, updated_at)
  VALUES (p_room_id, v_body, v_uid, now())
  ON CONFLICT (room_id) DO UPDATE
    SET body = EXCLUDED.body, pinned_by = EXCLUDED.pinned_by, updated_at = now();

  RETURN jsonb_build_object('ok', true, 'announcement', v_body);
END;
$$;

-- The room page carries the announcement, so it comes back with the room
-- rather than in a second round trip.
CREATE OR REPLACE FUNCTION public.get_room_by_handle(p_handle text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_handle text := lower(btrim(coalesce(p_handle, '')));
  v_room public.rooms%ROWTYPE;
  v_redirect text;
BEGIN
  SELECT * INTO v_room FROM public.rooms WHERE lower(handle) = v_handle;

  IF NOT FOUND THEN
    SELECT r.handle INTO v_redirect
    FROM public.room_handle_history h
    JOIN public.rooms r ON r.id = h.room_id
    WHERE lower(h.old_handle) = v_handle AND h.expires_at > now();

    IF v_redirect IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'moved', 'handle', v_redirect);
    END IF;

    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'room', jsonb_build_object(
      'id', v_room.id,
      'handle', v_room.handle,
      'display_name', v_room.display_name,
      'avatar_path', v_room.avatar_path,
      'brand', v_room.brand,
      'intro', v_room.intro,
      'timezone', v_room.timezone,
      'is_active', public.room_is_active(v_room.id),
      'announcement', (
        SELECT a.body FROM public.room_announcements a WHERE a.room_id = v_room.id
      ),
      'member_count', (
        SELECT count(*) FROM public.room_members
        WHERE room_id = v_room.id AND left_at IS NULL
      ),
      'my_role', CASE WHEN auth.uid() IS NULL THEN NULL
                      ELSE public.room_role(v_room.id, auth.uid()) END
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_room_announcement(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_room_announcement(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.get_room_by_handle(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_room_by_handle(text) TO anon, authenticated;
