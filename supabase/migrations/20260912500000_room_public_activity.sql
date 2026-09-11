-- The athlete-facing activity feed, and the setting that governs it.
--
-- Decided in docs/plans/coach-rooms-decisions.md §4, against two criteria:
-- encourage account creation, and make sure guests come back.
--
--   member with activity_visible (the default)  ->  named
--   member who opted out                        ->  unnamed row
--   guest, who has no membership row            ->  unnamed row
--
-- Nobody is omitted. Omitting guests makes the feed dishonest -- a room that
-- ran twenty athletes, most of them guests, would render as a room that ran six
-- -- and tells the one person the room loop exists to convert that their effort
-- did not count. An unnamed row says the opposite: the guest sees their result
-- land on their coach's page, and the only thing missing is the name, which is
-- exactly what an account buys.
--
-- `activity_visible` has existed since the boundary migration with no reader.
-- This is the reader. It is a *member* setting; a guest does not get one
-- because the guest state already is the private state.
--
-- What this deliberately does NOT return:
--   * user_id -- never, to anyone, on a public read.
--   * a guest's nickname.
--   * is_guest. An opted-out member and a guest must be the same row, or the
--     flag leaks the choice it exists to honour.

CREATE INDEX IF NOT EXISTS idx_room_members_room_user_active
  ON public.room_members (room_id, user_id) WHERE left_at IS NULL;

CREATE OR REPLACE FUNCTION public.list_room_activity(p_room_id uuid, p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  IF p_room_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT coalesce(jsonb_agg(row ORDER BY ord DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      psr.updated_at AS ord,
      jsonb_build_object(
        -- The athlete's own device holds this for the missions it ran, so a
        -- guest can recognise their own row without the server knowing who is
        -- looking. A bare uuid that identifies nothing on its own.
        'participant_id', p.id,
        'mission_id', m.id,
        'template_id', m.template_id,
        -- Named only for a current member who has not opted out. Everyone
        -- else, guest or opted-out member alike, is null.
        'nickname', CASE
          WHEN EXISTS (
            SELECT 1 FROM public.room_members rm
            WHERE rm.room_id = p_room_id
              AND rm.user_id = p.user_id
              AND rm.left_at IS NULL
              AND rm.activity_visible
          ) THEN p.nickname
          ELSE NULL
        END,
        -- The reps or rounds the athlete actually did. final_score is the
        -- P.V.I.- and domain-adjusted number and is not what "140 reps" means.
        'base_score', (psr.score_breakdown ->> 'baseScore')::numeric,
        'score_unit', CASE
          WHEN EXISTS (
            SELECT 1 FROM jsonb_array_elements(m.workout) e
            WHERE (e ->> 'reps') IS NOT NULL
          ) THEN 'reps'
          ELSE 'rounds'
        END,
        'finished_at', psr.updated_at,
        -- How many hosts said "I saw that". The count, never who: an athlete
        -- seeing their coach noticed is the return loop the reaction was built
        -- for, and until now nothing showed it to them at all.
        'reaction_count', (
          SELECT count(*) FROM public.room_reactions r
          WHERE r.participant_id = p.id AND r.segment_index = psr.segment_index
        )
      ) AS row
    FROM public.missions m
    JOIN public.participants p ON p.mission_id = m.id
    JOIN public.participant_segment_results psr
      ON psr.participant_id = p.id AND psr.segment_index = m.segment_index
    WHERE m.room_id = p_room_id
      AND psr.final_score IS NOT NULL
      AND p.role <> 'host'
    ORDER BY psr.updated_at DESC
    LIMIT least(greatest(coalesce(p_limit, 20), 1), 50)
  ) rows;

  RETURN jsonb_build_object('ok', true, 'activity', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.list_room_activity(uuid, int) FROM PUBLIC;
-- Public on purpose: a room address exists to be posted anywhere, and the feed
-- is the page's answer to "why come back".
GRANT EXECUTE ON FUNCTION public.list_room_activity(uuid, int) TO anon, authenticated;

-- The opt-out. Default-on only survives if turning it off is one tap, so this
-- is a member's own switch and needs no host involvement.
CREATE OR REPLACE FUNCTION public.set_room_activity_visible(p_room_id uuid, p_visible boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  UPDATE public.room_members
  SET activity_visible = coalesce(p_visible, true)
  WHERE room_id = p_room_id AND user_id = v_uid AND left_at IS NULL;

  IF NOT FOUND THEN
    -- Not a member of this room, so there is no name of theirs on its page to
    -- govern. Distinct from 'forbidden': nothing was refused.
    RETURN jsonb_build_object('ok', false, 'reason', 'not_a_member');
  END IF;

  RETURN jsonb_build_object('ok', true, 'activity_visible', coalesce(p_visible, true));
END;
$$;

REVOKE ALL ON FUNCTION public.set_room_activity_visible(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_room_activity_visible(uuid, boolean) TO authenticated;

-- The room page needs the viewer's own setting to render the opt-out next to
-- the names. One field on the read it already makes, rather than a second
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
      )
    )
  );
END;
$$;
