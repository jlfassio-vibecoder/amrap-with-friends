-- Campaigns phase 2: joining a campaign, leaving it, and previewing an
-- invite before committing to twelve weeks of it.
--
-- The invite code is the secret, exactly as a session's rally link is: anyone
-- holding it may preview the campaign, which is what lets a signed-out
-- visitor see what they are being invited to before they create an account.
-- Membership itself still requires an account and a completed profile.

-- A campaign is a crew, not a broadcast. The cap is generous enough for a
-- gym class and small enough that a leaked code cannot be used to bloat a
-- campaign indefinitely.
CREATE OR REPLACE FUNCTION public.campaign_member_limit()
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, extensions
AS $$ SELECT 50 $$;

CREATE OR REPLACE FUNCTION public.campaign_invite_preview(p_invite_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_code text;
  v_campaign public.campaigns%ROWTYPE;
  v_host text;
  v_members int;
  v_first date;
  v_last date;
BEGIN
  v_code := upper(btrim(coalesce(p_invite_code, '')));
  IF v_code = '' THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  SELECT * INTO v_campaign FROM public.campaigns WHERE invite_code = v_code;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  SELECT coalesce(p.nickname, p.username)
  INTO v_host
  FROM public.athlete_profiles p
  WHERE p.user_id = v_campaign.host_user_id;

  SELECT count(*)::int INTO v_members
  FROM public.campaign_members
  WHERE campaign_id = v_campaign.id AND status = 'active';

  SELECT min(local_date), max(local_date)
  INTO v_first, v_last
  FROM public.campaign_occurrences
  WHERE campaign_id = v_campaign.id;

  -- Deliberately narrow: name, shape and who is running it. Not the
  -- calendar and not the roster — holding the code is not membership.
  RETURN jsonb_build_object(
    'ok', true,
    'name', v_campaign.name,
    'goal', v_campaign.goal,
    'week_count', v_campaign.week_count,
    'sessions_per_week', v_campaign.sessions_per_week,
    'status', v_campaign.status,
    'host_nickname', v_host,
    'member_count', v_members,
    'member_limit', public.campaign_member_limit(),
    'first_session_date', v_first,
    'last_session_date', v_last
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.campaign_invite_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.campaign_invite_preview(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.join_campaign(p_invite_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_code text;
  v_campaign public.campaigns%ROWTYPE;
  v_existing public.campaign_members%ROWTYPE;
  v_members int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.athlete_profiles WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Intake required';
  END IF;

  v_code := upper(btrim(coalesce(p_invite_code, '')));
  IF v_code = '' THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  -- Locked so two friends clicking the link at once cannot both slip past
  -- the member cap.
  SELECT * INTO v_campaign
  FROM public.campaigns
  WHERE invite_code = v_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  IF v_campaign.status IN ('complete', 'abandoned') THEN
    RAISE EXCEPTION 'Campaign closed';
  END IF;

  SELECT * INTO v_existing
  FROM public.campaign_members
  WHERE campaign_id = v_campaign.id AND user_id = v_uid;

  -- Idempotent: clicking the link twice, or re-joining after leaving, is not
  -- an error.
  IF FOUND THEN
    IF v_existing.status <> 'active' THEN
      UPDATE public.campaign_members
      SET status = 'active', joined_at = now()
      WHERE id = v_existing.id;
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'campaign_id', v_campaign.id,
      'name', v_campaign.name,
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
  VALUES (v_campaign.id, v_uid, 'member');

  RETURN jsonb_build_object(
    'ok', true,
    'campaign_id', v_campaign.id,
    'name', v_campaign.name,
    'already_member', false
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.join_campaign(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_campaign(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.leave_campaign(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_member public.campaign_members%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_member
  FROM public.campaign_members
  WHERE campaign_id = p_campaign_id AND user_id = v_uid AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  -- The host owns the campaign; leaving it would orphan everyone else's
  -- calendar. Ending the campaign is a different action.
  IF v_member.role = 'host' THEN
    RAISE EXCEPTION 'Host cannot leave';
  END IF;

  -- Kept as a row rather than deleted: the athlete's completed sessions stay
  -- attributable, and re-joining restores their place.
  UPDATE public.campaign_members
  SET status = 'left'
  WHERE id = v_member.id;

  RETURN jsonb_build_object('ok', true, 'campaign_id', p_campaign_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.leave_campaign(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_campaign(uuid) TO authenticated;
