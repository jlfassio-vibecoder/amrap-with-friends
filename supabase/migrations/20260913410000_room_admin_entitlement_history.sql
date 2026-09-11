-- The renewal case, which the first version made unreachable.
--
-- `list_rooms_for_admin` selected the room's entitlement with
-- `expires_at IS NULL OR expires_at > now()` -- an *active* entitlement. A host
-- whose grant had lapsed therefore came back with `entitlement: null`, which is
-- exactly what a host who was never granted one looks like, so the screen
-- offered them "Activate 12 months" instead of "Renew".
--
-- That defeated the only thing the screen exists to distinguish. The unit tests
-- covered the expired state correctly and still passed, because they asserted
-- against a state the query could never produce -- which is the shape of bug
-- that gets through a test suite untouched.
--
-- A correction rather than an edit: 20260913400000 is already applied, and an
-- applied migration is immutable.
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
      -- The entitlement that best describes this host: an active one if there
      -- is one, otherwise the most recently lapsed. Never filtered away, so
      -- "never granted" means it, and the screen can tell the two apart.
      'entitlement', (
        SELECT jsonb_build_object('source', e.source, 'expires_at', e.expires_at)
        FROM public.entitlements e
        WHERE e.host_account_id = r.host_account_id
          AND e.feature = 'room'
        ORDER BY
          (e.expires_at IS NULL OR e.expires_at > now()) DESC,
          e.expires_at DESC NULLS FIRST
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
