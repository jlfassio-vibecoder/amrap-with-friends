-- The reminders opt-out, where the athlete can find it.
--
-- `set_room_reminders_enabled` shipped with the reminder sender, but the room
-- page had no way to know what the viewer's setting currently is, so the only
-- opt-out was the unsubscribe link at the bottom of an email. That works, and
-- it is not enough: the activity-feed decision (coach-rooms-decisions.md §4)
-- argues a default-on member setting is only defensible while the opt-out is
-- one tap and visible where the thing itself lives. A switch you can only
-- reach by first receiving the mail you did not want fails that test.
--
-- One more field on the read the page already makes, exactly like
-- `my_activity_visible` beside it, rather than a second round trip for one
-- boolean.
-- round trip for one boolean.
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
                      ELSE public.room_role(v_room.id, auth.uid()) END,
      -- The viewer's own setting, so the room page can offer the opt-out
      -- beside the names rather than in a settings page nobody opens. Null for
      -- a signed-out visitor and for anyone who is not a member.
      'my_activity_visible', (
        SELECT rm.activity_visible FROM public.room_members rm
        WHERE rm.room_id = v_room.id AND rm.user_id = auth.uid() AND rm.left_at IS NULL
      ),
      -- Same shape and the same null rule: null for a signed-out visitor and
      -- for anyone who is not a member, because neither has a setting to show.
      'my_reminders_enabled', (
        SELECT rm.reminders_enabled FROM public.room_members rm
        WHERE rm.room_id = v_room.id AND rm.user_id = auth.uid() AND rm.left_at IS NULL
      )
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_room_by_handle(text) TO anon, authenticated;
