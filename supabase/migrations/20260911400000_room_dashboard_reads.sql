-- What a host needs to see about their own room.
--
-- Two reads, both scoped to a room the caller actually runs. Membership is
-- checked with room_role() on the row's own room_id -- never coach_users,
-- which belongs to the platform owner.

-- The roster, for the co-host controls. Owners and co-hosts only: a member
-- does not get a list of everyone else in the room.
CREATE OR REPLACE FUNCTION public.list_room_members(p_room_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rows jsonb;
BEGIN
  IF v_uid IS NULL OR public.room_role(p_room_id, v_uid) NOT IN ('owner', 'cohost') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT coalesce(jsonb_agg(row ORDER BY row ->> 'joined_at'), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'user_id', m.user_id,
      'role', m.role,
      'joined_at', m.joined_at,
      -- The nickname they last used in this room's missions. Rooms have no
      -- profile of their own, and an email address is not the host's to see.
      'nickname', (
        SELECT p.nickname
        FROM public.participants p
        JOIN public.missions mi ON mi.id = p.mission_id
        WHERE p.user_id = m.user_id AND mi.room_id = p_room_id
        ORDER BY p.joined_at DESC
        LIMIT 1
      )
    ) AS row
    FROM public.room_members m
    WHERE m.room_id = p_room_id AND m.left_at IS NULL
  ) rows;

  RETURN jsonb_build_object('ok', true, 'members', v_rows);
END;
$$;

-- Who finished this week, and who came back.
--
-- "Came back" is the pilot's primary metric read from the host's side: an
-- athlete who has finished more than one mission in this room. A host who
-- cannot see that number has no way to tell whether the thing they are doing
-- weekly is working.
CREATE OR REPLACE FUNCTION public.room_activity_summary(p_room_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_since timestamptz := now() - interval '7 days';
  v_finished_week int;
  v_athletes_week int;
  v_returning int;
  v_missions_week int;
BEGIN
  IF v_uid IS NULL OR public.room_role(p_room_id, v_uid) NOT IN ('owner', 'cohost') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT
    count(*) FILTER (WHERE p.id IS NOT NULL),
    count(DISTINCT p.user_id)
  INTO v_finished_week, v_athletes_week
  FROM public.missions m
  JOIN public.participants p ON p.mission_id = m.id
  WHERE m.room_id = p_room_id
    AND m.state = 'finished'
    AND m.created_at >= v_since;

  SELECT count(*) INTO v_missions_week
  FROM public.missions m
  WHERE m.room_id = p_room_id AND m.created_at >= v_since;

  -- Signed-in athletes only: a guest who finishes twice cannot be recognised
  -- as the same person, and guessing would invent a returner.
  SELECT count(*) INTO v_returning
  FROM (
    SELECT p.user_id
    FROM public.missions m
    JOIN public.participants p ON p.mission_id = m.id
    WHERE m.room_id = p_room_id
      AND m.state = 'finished'
      AND p.user_id IS NOT NULL
    GROUP BY p.user_id
    HAVING count(DISTINCT m.id) > 1
  ) repeat_athletes;

  RETURN jsonb_build_object(
    'ok', true,
    'finished_this_week', coalesce(v_finished_week, 0),
    'athletes_this_week', coalesce(v_athletes_week, 0),
    'missions_this_week', coalesce(v_missions_week, 0),
    'returning_athletes', coalesce(v_returning, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_room_members(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.room_activity_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_room_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.room_activity_summary(uuid) TO authenticated;
