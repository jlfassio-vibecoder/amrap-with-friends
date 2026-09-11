-- Two latent findings from the review of #171-#181.
--
-- 1. A granted room could last for ever.
--
--    grant_room_entitlement passed p_expires_at straight through, and
--    room_is_active reads `expires_at IS NULL` as never-expiring. One null in
--    an admin call and a founding host has free hosting permanently, with
--    nothing scheduled to end it and no symptom except a host who never
--    converts.
--
--    A null expiry is legitimate for exactly one source: a live Stripe
--    subscription, whose end date is whenever it is cancelled rather than
--    something we write up front. Founding and pilot grants are time-boxed by
--    definition -- the plan gives founding hosts twelve months -- so the
--    constraint says so, and the RPC refuses before the constraint has to.
--
-- 2. join_room told an athlete their home coach was unchanged when they had
--    asked for nothing to change.
--
--    `home_coach_already_set` was true whenever the athlete had a coach and
--    this call inserted none -- including when the caller passed
--    p_set_home_coach = false and attribution was never attempted. A caller
--    honouring an unticked box would have said "Your home coach is unchanged",
--    implying the join touched attribution. It reports only what this call
--    actually found.

ALTER TABLE public.entitlements
  ADD CONSTRAINT entitlements_non_stripe_needs_expiry CHECK (
    source = 'stripe' OR expires_at IS NOT NULL
  );

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
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.coach_users WHERE user_id = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF p_source NOT IN ('founding', 'pilot') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_source');
  END IF;

  -- Refused here as well as by the constraint, so the caller gets a reason
  -- rather than a raised exception.
  IF p_expires_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expiry_required');
  END IF;

  IF p_expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expiry_in_past');
  END IF;

  INSERT INTO public.entitlements (host_account_id, feature, source, expires_at)
  VALUES (p_host_account_id, 'room', p_source, p_expires_at)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'entitlement_id', v_id);
END;
$$;

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
  v_attempted boolean := false;
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
    v_attempted := true;

    INSERT INTO public.athlete_home_coach (user_id, coach_user_id, room_id)
    VALUES (v_uid, v_owner_user_id, p_room_id)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING coach_user_id INTO v_inserted_coach;

    IF v_inserted_coach IS NOT NULL THEN
      INSERT INTO public.referral_ledger (athlete_user_id, coach_user_id, room_id, event)
      VALUES (v_uid, v_owner_user_id, p_room_id, 'attributed')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  SELECT coach_user_id INTO v_current_coach
  FROM public.athlete_home_coach WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'ok', true,
    'room_id', p_room_id,
    'home_coach_set', v_inserted_coach IS NOT NULL,
    -- Only when this call tried and lost to an existing coach. An athlete who
    -- unticked the box is not told that something they declined is unchanged.
    'home_coach_already_set',
      v_attempted AND v_inserted_coach IS NULL AND v_current_coach IS NOT NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.grant_room_entitlement(uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_room_entitlement(uuid, text, timestamptz) TO authenticated;
REVOKE ALL ON FUNCTION public.join_room(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_room(uuid, boolean) TO authenticated;
