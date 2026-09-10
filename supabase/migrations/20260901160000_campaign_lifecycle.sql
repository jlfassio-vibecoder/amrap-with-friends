-- Campaign lifecycle: ending a campaign early, and deleting one that never ran.
--
-- campaigns.status has always modelled 'abandoned', and CampaignDetailPage has
-- always shipped copy for it ("Ended early"), but nothing could write it. The
-- only writer of a terminal status was run_campaign_scheduler(), which sets
-- 'complete' once no occurrence is still planned or generated -- that is, after
-- the whole calendar has elapsed.
--
-- With a three-campaign cap per host (create_campaign) and leave_campaign
-- refusing the host outright, a 12-week campaign held one of those three slots
-- for 12 weeks whatever the host wanted, and the cap's own error told them to
-- "finish one first" with no way to finish one. These are that way out.
--
-- Two exits, because they answer different questions:
--
--   end_campaign     "we are not doing this any more". Allowed any time. Keeps
--                    the row, so members keep their finished sessions and can
--                    see why the calendar stopped.
--   delete_campaign  "this was never real". Only while nothing has run and
--                    nobody else has joined, so there is no history to lose and
--                    no one else's plan to destroy.

CREATE OR REPLACE FUNCTION public.end_campaign(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_campaign public.campaigns%ROWTYPE;
  v_skipped int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Locked against a concurrent join_campaign, which takes the same lock.
  SELECT * INTO v_campaign
  FROM public.campaigns
  WHERE id = p_campaign_id
  FOR UPDATE;

  -- Same error for "no such campaign" and "not yours", so a stranger cannot
  -- probe which campaign ids exist. This is the campaign_detail pattern.
  IF NOT FOUND OR v_campaign.host_user_id <> v_uid THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  IF v_campaign.status IN ('complete', 'abandoned') THEN
    RAISE EXCEPTION 'Campaign closed';
  END IF;

  UPDATE public.campaigns
  SET status = 'abandoned', updated_at = now()
  WHERE id = p_campaign_id;

  -- The scheduler only ages planned occurrences out of the schedule while the
  -- campaign is active, so without this they would sit at 'planned' forever and
  -- the detail page would keep promising sessions that can never run. Their
  -- window will never open now, which is what 'skipped' means.
  --
  -- Occurrences already generated are left alone: a session exists, and the
  -- scheduler's finish and classify passes do not filter on campaign status, so
  -- they still reach 'done' or 'skipped' on their own.
  UPDATE public.campaign_occurrences
  SET status = 'skipped'
  WHERE campaign_id = p_campaign_id
    AND status = 'planned'
    AND session_id IS NULL;

  GET DIAGNOSTICS v_skipped = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'campaign_id', p_campaign_id,
    'status', 'abandoned',
    'skipped_sessions', v_skipped
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.end_campaign(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.end_campaign(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_campaign(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_campaign public.campaigns%ROWTYPE;
  v_deleted int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_campaign
  FROM public.campaigns
  WHERE id = p_campaign_id
  FOR UPDATE;

  IF NOT FOUND OR v_campaign.host_user_id <> v_uid THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  -- These two checks exist for their error messages; the DELETE below repeats
  -- them as its own precondition, which is what actually makes the decision.
  IF EXISTS (
    SELECT 1 FROM public.campaign_occurrences
    WHERE campaign_id = p_campaign_id
      AND (status <> 'planned' OR session_id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Campaign already started';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.campaign_members
    WHERE campaign_id = p_campaign_id
      AND status = 'active'
      AND user_id <> v_uid
  ) THEN
    RAISE EXCEPTION 'Campaign has other athletes';
  END IF;

  -- Guarded in the statement rather than only above it: the cron generator does
  -- not lock the campaign row, so a session could be created between the checks
  -- and here. It inserts the session and stamps the occurrence in one
  -- transaction, so re-evaluating the condition at statement time sees both or
  -- neither, and a delete that would have orphaned a live session deletes
  -- nothing instead.
  DELETE FROM public.campaigns c
  WHERE c.id = p_campaign_id
    AND c.host_user_id = v_uid
    AND NOT EXISTS (
      SELECT 1 FROM public.campaign_occurrences o
      WHERE o.campaign_id = c.id
        AND (o.status <> 'planned' OR o.session_id IS NOT NULL)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.campaign_members m
      WHERE m.campaign_id = c.id
        AND m.status = 'active'
        AND m.user_id <> v_uid
    );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    RAISE EXCEPTION 'Campaign already started';
  END IF;

  -- campaign_occurrences and campaign_members cascade from campaigns.
  RETURN jsonb_build_object('ok', true, 'campaign_id', p_campaign_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_campaign(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_campaign(uuid) TO authenticated;
