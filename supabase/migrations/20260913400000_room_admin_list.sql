-- The rooms list the pilot cannot be run without.
--
-- `grant_room_entitlement` has existed since the boundary migration and
-- correctly checks `coach_users`, because activating a founding host is an AWF
-- decision rather than a host's. What it has never had is a caller: nothing in
-- `src/` invokes it, so no founding host could be activated through the
-- product at all.
--
-- The symptom is not an error. A new host creates their room, everything
-- appears to work, and then every mission they schedule is refused with
-- `room_inactive` and no reminder ever sends -- because `room_is_active`
-- requires an unexpired entitlement and there is no way to grant one. The
-- first real room hit exactly this and had to be unblocked with a hand-written
-- INSERT.
--
-- This is the read behind that screen. The write already exists.

CREATE OR REPLACE FUNCTION public.list_rooms_for_admin()
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
  -- The same allowlist `grant_room_entitlement` checks. A co-host or a room
  -- owner must never reach this: it returns other hosts' rooms and their
  -- owners' email addresses.
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.coach_users WHERE user_id = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT coalesce(jsonb_agg(row ORDER BY row ->> 'created_at' DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'room_id', r.id,
      'handle', r.handle,
      'display_name', r.display_name,
      'created_at', r.created_at,
      'host_account_id', r.host_account_id,
      'owner_email', u.email,
      'member_count', (
        SELECT count(*) FROM public.room_members m
        WHERE m.room_id = r.id AND m.left_at IS NULL
      ),
      'is_active', public.room_is_active(r.id),
      -- The live entitlement, if any. Returned rather than just `is_active` so
      -- the screen can say *why* a room is off: never granted, or expired.
      'entitlement', (
        SELECT jsonb_build_object('source', e.source, 'expires_at', e.expires_at)
        FROM public.entitlements e
        WHERE e.host_account_id = r.host_account_id
          AND e.feature = 'room'
          AND (e.expires_at IS NULL OR e.expires_at > now())
        ORDER BY e.expires_at DESC NULLS FIRST
        LIMIT 1
      )
    ) AS row
    FROM public.rooms r
    JOIN public.host_accounts h ON h.id = r.host_account_id
    JOIN auth.users u ON u.id = h.owner_user_id
  ) rows;

  RETURN jsonb_build_object('ok', true, 'rooms', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.list_rooms_for_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_rooms_for_admin() TO authenticated;
