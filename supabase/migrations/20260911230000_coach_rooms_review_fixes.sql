-- Coach's Rooms, phase 1: review fixes.
--
-- Five defects from review on the phase 1 PR, four of them concurrency or
-- authorization. Applied migrations are immutable, so these are corrections
-- rather than edits.

-- 1. One host account per owner was an invariant create_room assumed and
--    nothing enforced. Two concurrent first-time calls could both find no
--    account and both insert one. The table is empty, so there is nothing to
--    reconcile first.
DROP INDEX IF EXISTS public.idx_host_accounts_owner;
CREATE UNIQUE INDEX IF NOT EXISTS host_accounts_owner_key
  ON public.host_accounts (owner_user_id);

-- 2. An athlete has exactly one home coach, so they may have exactly one
--    attributed row -- not one per coach. Keyed by (athlete, coach), a race
--    could leave two attributions to two different coaches, and a payout query
--    would pay both.
DROP INDEX IF EXISTS public.referral_ledger_attributed_key;
CREATE UNIQUE INDEX IF NOT EXISTS referral_ledger_attributed_key
  ON public.referral_ledger (athlete_user_id)
  WHERE event = 'attributed';

-- 3. A released handle redirects for 90 days but must not be reissued to a
--    different host for 12 months. One column cannot mean both. Nothing writes
--    this table yet -- handle changes arrive in phase 2 -- which is exactly why
--    the shape should be right before anything does.
ALTER TABLE public.room_handle_history
  ADD COLUMN IF NOT EXISTS reissue_after timestamptz;

UPDATE public.room_handle_history
SET reissue_after = released_at + interval '12 months'
WHERE reissue_after IS NULL;

ALTER TABLE public.room_handle_history
  ALTER COLUMN reissue_after SET NOT NULL;

-- 4. create_room: honour the reissue hold, not the redirect window.
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

  IF EXISTS (SELECT 1 FROM public.reserved_handles WHERE handle = v_handle) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'handle_reserved');
  END IF;

  -- The 12-month hold, not the 90-day redirect: a handle stops redirecting
  -- long before it may belong to someone else.
  IF EXISTS (
    SELECT 1 FROM public.room_handle_history
    WHERE lower(old_handle) = v_handle
      AND reissue_after > now()
      AND room_id IS DISTINCT FROM (
        SELECT r.id FROM public.rooms r
        JOIN public.host_accounts h ON h.id = r.host_account_id
        WHERE h.owner_user_id = v_uid
      )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'handle_taken');
  END IF;

  IF EXISTS (SELECT 1 FROM public.rooms WHERE lower(handle) = v_handle) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'handle_taken');
  END IF;

  SELECT id INTO v_host_account_id
  FROM public.host_accounts
  WHERE owner_user_id = v_uid
  LIMIT 1;

  IF v_host_account_id IS NULL THEN
    -- The unique index above is the real guard; ON CONFLICT turns a lost race
    -- into the same answer rather than an error.
    INSERT INTO public.host_accounts (owner_user_id, kind, name)
    VALUES (v_uid, coalesce(p_kind, 'coach'), btrim(p_display_name))
    ON CONFLICT (owner_user_id) DO NOTHING
    RETURNING id INTO v_host_account_id;

    IF v_host_account_id IS NULL THEN
      SELECT id INTO v_host_account_id
      FROM public.host_accounts WHERE owner_user_id = v_uid;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.rooms WHERE host_account_id = v_host_account_id) THEN
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

-- 5. join_room: the ledger row follows the home-coach insert winning, not the
--    caller's earlier read.
--
--    The old version read athlete_home_coach, found nothing, then inserted with
--    ON CONFLICT DO NOTHING and wrote a ledger row regardless. Two joins into
--    different rooms at once would both read null, both "succeed", and both
--    write an attribution -- to two different coaches. RETURNING tells us
--    whether this statement is the one that set it.
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
  v_inserted_coach uuid;
  v_current_coach uuid;
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

  INSERT INTO public.room_members (room_id, user_id, role)
  VALUES (p_room_id, v_uid, 'member')
  ON CONFLICT (room_id, user_id) DO UPDATE SET left_at = NULL;

  IF p_set_home_coach AND v_owner_user_id <> v_uid THEN
    INSERT INTO public.athlete_home_coach (user_id, coach_user_id, room_id)
    VALUES (v_uid, v_owner_user_id, p_room_id)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING coach_user_id INTO v_inserted_coach;

    -- Only the statement that actually set the home coach opens the ledger.
    IF v_inserted_coach IS NOT NULL THEN
      INSERT INTO public.referral_ledger (athlete_user_id, coach_user_id, room_id, event)
      VALUES (v_uid, v_owner_user_id, p_room_id, 'attributed')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- Re-read rather than trusting an earlier look: under a race the winner may
  -- be another call, and the athlete should be told who their coach actually is.
  SELECT coach_user_id INTO v_current_coach
  FROM public.athlete_home_coach WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'ok', true,
    'room_id', p_room_id,
    'home_coach_set', v_inserted_coach IS NOT NULL,
    'home_coach_already_set', v_current_coach IS NOT NULL AND v_inserted_coach IS NULL
  );
END;
$$;

-- 6. PostgreSQL grants EXECUTE on a new function to PUBLIC by default, so the
--    auth-only RPCs were reachable by anon despite the `TO authenticated`
--    grants. They answered not_authenticated, but an unnecessary public
--    SECURITY DEFINER surface is not the repo's convention.
REVOKE ALL ON FUNCTION public.create_room(text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_room(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_room(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_room_cohost(uuid, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.grant_room_entitlement(uuid, text, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_my_rooms() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_room_by_handle(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_room(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_room(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_room(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_room_cohost(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_room_entitlement(uuid, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_rooms() TO authenticated;
-- The room page is public by design.
GRANT EXECUTE ON FUNCTION public.get_room_by_handle(text) TO anon, authenticated;
