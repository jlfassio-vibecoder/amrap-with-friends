-- Lets a campaign host put a squad friend straight onto the roster instead of
-- sending them the rally link and waiting.
--
-- Same reach rule as assign_workout: squad_friends stores both directions of an
-- accepted friendship, so one EXISTS settles it. A friendship is already
-- mutually consented, which is why the athlete lands on the roster directly and
-- can leave afterwards rather than needing an accept step of their own.
--
-- Everything else mirrors join_campaign — the same campaign lock, the same
-- member cap, the same idempotence and the same reactivation of a member who
-- had left — so the two ways onto a roster cannot disagree about what a
-- membership is.

CREATE OR REPLACE FUNCTION public.add_squad_friend_to_campaign(
  p_campaign_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_campaign public.campaigns%ROWTYPE;
  v_existing public.campaign_members%ROWTYPE;
  v_members int;
  v_nickname text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Pick a squad friend to add';
  END IF;

  -- Locked against a concurrent join_campaign or end_campaign, which take the
  -- same lock, so two people arriving at once cannot both slip past the cap.
  SELECT * INTO v_campaign
  FROM public.campaigns
  WHERE id = p_campaign_id
  FOR UPDATE;

  -- Same error for "no such campaign" and "not yours", so a member cannot
  -- probe which campaign ids exist. This is the end_campaign pattern.
  IF NOT FOUND OR v_campaign.host_user_id <> v_uid THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  IF v_campaign.status IN ('complete', 'abandoned') THEN
    RAISE EXCEPTION 'Campaign closed';
  END IF;

  -- The reach check. Not a friend means not addable, whoever the host is.
  IF NOT EXISTS (
    SELECT 1 FROM public.squad_friends
    WHERE user_id = v_uid AND friend_user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Pick a squad friend to add';
  END IF;

  SELECT coalesce(p.nickname, p.username)
  INTO v_nickname
  FROM public.athlete_profiles p
  WHERE p.user_id = p_user_id;

  -- my_squad already filters to friends who have a profile, so this is
  -- belt-and-braces against a profile deleted between listing and adding.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Squad friend has no profile';
  END IF;

  SELECT * INTO v_existing
  FROM public.campaign_members
  WHERE campaign_id = v_campaign.id AND user_id = p_user_id;

  -- Idempotent, exactly as join_campaign is: adding someone twice, or adding
  -- back someone who left, is not an error.
  IF FOUND THEN
    IF v_existing.status <> 'active' THEN
      UPDATE public.campaign_members
      SET status = 'active', joined_at = now()
      WHERE id = v_existing.id;
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'campaign_id', v_campaign.id,
      'user_id', p_user_id,
      'nickname', v_nickname,
      'already_member', v_existing.status = 'active'
    );
  END IF;

  SELECT count(*)::int INTO v_members
  FROM public.campaign_members
  WHERE campaign_id = v_campaign.id AND status = 'active';

  IF v_members >= public.campaign_member_limit() THEN
    RAISE EXCEPTION 'Campaign full';
  END IF;

  INSERT INTO public.campaign_members (campaign_id, user_id, role)
  VALUES (v_campaign.id, p_user_id, 'member');

  RETURN jsonb_build_object(
    'ok', true,
    'campaign_id', v_campaign.id,
    'user_id', p_user_id,
    'nickname', v_nickname,
    'already_member', false
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_squad_friend_to_campaign(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_squad_friend_to_campaign(uuid, uuid) TO authenticated;
