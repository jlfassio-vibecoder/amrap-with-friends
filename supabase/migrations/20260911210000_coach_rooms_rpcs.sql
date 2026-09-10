-- Coach's Rooms, phase 1: the authorized ways in and out.
--
-- The tables from 20260911200000 are revoked from anon and authenticated, so
-- these are the only paths. Two rules run through all of them:
--
--   * A caller's role is read from room_members on the row's own room_id.
--     Never from coach_users -- that allowlist is the platform owner's, and a
--     paying host must never acquire it.
--   * Room membership grants the room. It does not grant a mission's live
--     participant rows; those stay with mission participation.

-- Is this user an owner or co-host of this room, right now?
CREATE OR REPLACE FUNCTION public.room_role(p_room_id uuid, p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT role
  FROM public.room_members
  WHERE room_id = p_room_id
    AND user_id = p_user_id
    AND left_at IS NULL
  LIMIT 1;
$$;

-- Whether a room may run missions today. Read from entitlement rows, never a
-- flag on the account -- an expired founding grant simply stops matching.
CREATE OR REPLACE FUNCTION public.room_is_active(p_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.entitlements e
    JOIN public.rooms r ON r.host_account_id = e.host_account_id
    WHERE r.id = p_room_id
      AND e.feature = 'room'
      AND e.starts_at <= now()
      AND (e.expires_at IS NULL OR e.expires_at > now())
  );
$$;

-- ---------------------------------------------------------------------------
-- create_room
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_room(
  p_handle text,
  p_display_name text,
  p_kind text DEFAULT 'coach',
  p_timezone text DEFAULT 'UTC'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_handle text := lower(btrim(coalesce(p_handle, '')));
  v_host_account_id uuid;
  v_room_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  IF v_handle !~ '^[a-z0-9][a-z0-9_]{2,23}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_handle');
  END IF;

  -- A handle released within the last 90 days still redirects, so it is not
  -- free to give away even though no room holds it.
  IF EXISTS (
    SELECT 1 FROM public.room_handle_history
    WHERE lower(old_handle) = v_handle AND expires_at > now()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'handle_taken');
  END IF;

  IF EXISTS (SELECT 1 FROM public.rooms WHERE lower(handle) = v_handle) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'handle_taken');
  END IF;

  -- One host account, one room, in v1.
  SELECT id INTO v_host_account_id
  FROM public.host_accounts
  WHERE owner_user_id = v_uid
  LIMIT 1;

  IF v_host_account_id IS NULL THEN
    INSERT INTO public.host_accounts (owner_user_id, kind, name)
    VALUES (v_uid, coalesce(p_kind, 'coach'), btrim(p_display_name))
    RETURNING id INTO v_host_account_id;
  ELSIF EXISTS (SELECT 1 FROM public.rooms WHERE host_account_id = v_host_account_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'room_exists');
  END IF;

  INSERT INTO public.rooms (host_account_id, handle, display_name, timezone)
  VALUES (v_host_account_id, v_handle, btrim(p_display_name), coalesce(p_timezone, 'UTC'))
  RETURNING id INTO v_room_id;

  INSERT INTO public.room_members (room_id, user_id, role)
  VALUES (v_room_id, v_uid, 'owner');

  RETURN jsonb_build_object(
    'ok', true,
    'room_id', v_room_id,
    'host_account_id', v_host_account_id,
    'handle', v_handle
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- get_room_by_handle -- the public read behind /@handle
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- join_room -- one athlete decision, three records
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.join_room(
  p_room_id uuid,
  p_set_home_coach boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner_user_id uuid;
  v_existing_coach uuid;
  v_home_coach_set boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT h.owner_user_id INTO v_owner_user_id
  FROM public.rooms r
  JOIN public.host_accounts h ON h.id = r.host_account_id
  WHERE r.id = p_room_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- Membership. Rejoining reopens the same row rather than making a second one.
  INSERT INTO public.room_members (room_id, user_id, role)
  VALUES (p_room_id, v_uid, 'member')
  ON CONFLICT (room_id, user_id) DO UPDATE SET left_at = NULL;

  -- Attribution, only if the athlete asked and has no home coach yet. Set once:
  -- an athlete who already has one keeps them, and the caller is told so rather
  -- than silently reassigned. A host is never their own athlete's home coach.
  IF p_set_home_coach AND v_owner_user_id <> v_uid THEN
    SELECT coach_user_id INTO v_existing_coach
    FROM public.athlete_home_coach WHERE user_id = v_uid;

    IF v_existing_coach IS NULL THEN
      INSERT INTO public.athlete_home_coach (user_id, coach_user_id, room_id)
      VALUES (v_uid, v_owner_user_id, p_room_id)
      ON CONFLICT (user_id) DO NOTHING;
      v_home_coach_set := true;

      -- The ledger starts here, in phase 1, even though payouts are phase 4.
      INSERT INTO public.referral_ledger (athlete_user_id, coach_user_id, room_id, event)
      VALUES (v_uid, v_owner_user_id, p_room_id, 'attributed')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'room_id', p_room_id,
    'home_coach_set', v_home_coach_set,
    'home_coach_already_set', v_existing_coach IS NOT NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_room(p_room_id uuid)
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

  -- Owners cannot leave; that is a transfer, which v1 does not have.
  IF public.room_role(p_room_id, v_uid) = 'owner' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'owner_cannot_leave');
  END IF;

  UPDATE public.room_members
  SET left_at = now()
  WHERE room_id = p_room_id AND user_id = v_uid AND left_at IS NULL;

  -- Deliberately does not touch athlete_home_coach or the ledger: leaving a
  -- room never moves a commission.
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- Co-hosts
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_room_cohost(
  p_room_id uuid,
  p_user_id uuid,
  p_is_cohost boolean
)
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

  -- Only the owner promotes and demotes. A co-host cannot appoint co-hosts.
  IF public.room_role(p_room_id, v_uid) IS DISTINCT FROM 'owner' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF p_user_id = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cannot_change_owner');
  END IF;

  UPDATE public.room_members
  SET role = CASE WHEN p_is_cohost THEN 'cohost' ELSE 'member' END
  WHERE room_id = p_room_id AND user_id = p_user_id AND left_at IS NULL
    AND role <> 'owner';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_a_member');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- Entitlements -- the admin path, constrained by `source`
-- ---------------------------------------------------------------------------

-- Decision 3. This path may only write a founding or pilot grant. The Stripe
-- source is unreachable from here, and the table's own CHECK requires a
-- subscription id for it, so a bug in this function cannot forge a paid one.
CREATE OR REPLACE FUNCTION public.grant_room_entitlement(
  p_host_account_id uuid,
  p_source text,
  p_expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  -- The platform-owner allowlist, used here and nowhere else in rooms: granting
  -- free access is an AWF decision, not a host's.
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.coach_users WHERE user_id = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF p_source NOT IN ('founding', 'pilot') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_source');
  END IF;

  INSERT INTO public.entitlements (host_account_id, feature, source, expires_at)
  VALUES (p_host_account_id, 'room', p_source, p_expires_at)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'entitlement_id', v_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Dashboard reads
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_my_rooms()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rooms jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT coalesce(jsonb_agg(row ORDER BY row ->> 'joined_at'), '[]'::jsonb)
  INTO v_rooms
  FROM (
    SELECT jsonb_build_object(
      'room_id', r.id,
      'handle', r.handle,
      'display_name', r.display_name,
      'role', m.role,
      'joined_at', m.joined_at,
      'is_active', public.room_is_active(r.id),
      'member_count', (
        SELECT count(*) FROM public.room_members
        WHERE room_id = r.id AND left_at IS NULL
      )
    ) AS row
    FROM public.room_members m
    JOIN public.rooms r ON r.id = m.room_id
    WHERE m.user_id = v_uid AND m.left_at IS NULL
  ) rows;

  RETURN jsonb_build_object('ok', true, 'rooms', v_rooms);
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.room_role(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.room_is_active(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_room_by_handle(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_room(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_room(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_room(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_room_cohost(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_room_entitlement(uuid, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_rooms() TO authenticated;
