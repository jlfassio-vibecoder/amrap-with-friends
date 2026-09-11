-- Close the permanent entitlement properly.
--
-- 20260912200000 rejected a null expiry and stopped there. `infinity` is a real
-- timestamptz value: it is not null, so the constraint accepted it, and
-- `'infinity' <= now()` is false, so the RPC's past-date check accepted it too.
-- room_is_active then reads `expires_at > now()` as true for ever. The hole the
-- last migration was written to close was still open, reachable by a different
-- value.
--
-- "Has an end date" is what the rule always meant, and isfinite() is how to say
-- it. Null and infinity are the same answer to that question.
--
-- Also: `p_source NOT IN (...)` is not null-safe, so a null source skipped the
-- branch and fell through to the NOT NULL column constraint -- a raised
-- exception instead of a reason, unlike every other bad source.

ALTER TABLE public.entitlements
  DROP CONSTRAINT IF EXISTS entitlements_non_stripe_needs_expiry;

ALTER TABLE public.entitlements
  ADD CONSTRAINT entitlements_non_stripe_needs_expiry CHECK (
    source = 'stripe' OR (expires_at IS NOT NULL AND isfinite(expires_at))
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

  -- Null-safe: a null source is an invalid source, not a skipped check.
  IF p_source IS NULL OR p_source NOT IN ('founding', 'pilot') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_source');
  END IF;

  -- Null and infinity are the same answer to "when does this end".
  IF p_expires_at IS NULL OR NOT isfinite(p_expires_at) THEN
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

REVOKE ALL ON FUNCTION public.grant_room_entitlement(uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_room_entitlement(uuid, text, timestamptz) TO authenticated;
