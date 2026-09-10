-- Editing a campaign: its name and goal, and the date of a session that has
-- not run yet.
--
-- Deliberately not editable here: the workouts. A campaign's benchmark is the
-- number every result is measured against, and letting it be swapped after the
-- fact would silently change what "+8 reps" means. Nothing below touches
-- campaign_occurrences.workout or .template_id, so the benchmark cannot move
-- however the schedule is rearranged.
--
-- Also not here: length, training days and workout styles. Changing those
-- re-plans every session, which is what create_campaign already does -- and a
-- campaign that has not started can now be deleted and made again.

CREATE OR REPLACE FUNCTION public.update_campaign(
  p_campaign_id uuid,
  p_name text,
  p_goal text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_campaign public.campaigns%ROWTYPE;
  v_name text;
  v_goal text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

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

  v_name := btrim(coalesce(p_name, ''));
  IF v_name = '' OR length(v_name) > 80 THEN
    RAISE EXCEPTION 'Name the campaign in 80 characters or fewer';
  END IF;

  -- An emptied goal is "no goal", not an empty string, so the detail page can
  -- keep testing it for null.
  v_goal := nullif(btrim(coalesce(p_goal, '')), '');
  IF v_goal IS NOT NULL AND length(v_goal) > 280 THEN
    RAISE EXCEPTION 'Keep the goal to 280 characters or fewer';
  END IF;

  UPDATE public.campaigns
  SET name = v_name, goal = v_goal, updated_at = now()
  WHERE id = p_campaign_id;

  RETURN jsonb_build_object(
    'ok', true,
    'campaign_id', p_campaign_id,
    'name', v_name,
    'goal', v_goal
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_campaign(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_campaign(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reschedule_campaign_occurrence(
  p_occurrence_id uuid,
  p_local_date date,
  p_local_time time
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_occ public.campaign_occurrences%ROWTYPE;
  v_campaign public.campaigns%ROWTYPE;
  v_new timestamp;
  v_prev timestamp;
  v_next timestamp;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_local_date IS NULL OR p_local_time IS NULL THEN
    RAISE EXCEPTION 'Pick a date and a time';
  END IF;

  SELECT o.* INTO v_occ
  FROM public.campaign_occurrences o
  WHERE o.id = p_occurrence_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  SELECT * INTO v_campaign
  FROM public.campaigns
  WHERE id = v_occ.campaign_id
  FOR UPDATE;

  IF NOT FOUND OR v_campaign.host_user_id <> v_uid THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  IF v_campaign.status IN ('complete', 'abandoned') THEN
    RAISE EXCEPTION 'Campaign closed';
  END IF;

  -- Once a session exists the staging area is open and people may be on their
  -- way to it, so the date stops being the host's to change.
  IF v_occ.status <> 'planned' OR v_occ.session_id IS NOT NULL THEN
    RAISE EXCEPTION 'Session already scheduled';
  END IF;

  v_new := (p_local_date::text || ' ' || p_local_time::text)::timestamp;

  IF (v_new AT TIME ZONE v_campaign.timezone) <= now() THEN
    RAISE EXCEPTION 'Pick a time in the future';
  END IF;

  -- The whole app reads a campaign in sequence order -- groupOccurrencesByWeek
  -- sorts on it, and deriveCampaignRoles reasons about position, not date. A
  -- session that jumped over its neighbours would render out of order and make
  -- the schedule look broken, so a move has to stay inside its own slot.
  SELECT (o.local_date::text || ' ' || o.local_time::text)::timestamp
  INTO v_prev
  FROM public.campaign_occurrences o
  WHERE o.campaign_id = v_occ.campaign_id AND o.sequence < v_occ.sequence
  ORDER BY o.sequence DESC
  LIMIT 1;

  SELECT (o.local_date::text || ' ' || o.local_time::text)::timestamp
  INTO v_next
  FROM public.campaign_occurrences o
  WHERE o.campaign_id = v_occ.campaign_id AND o.sequence > v_occ.sequence
  ORDER BY o.sequence ASC
  LIMIT 1;

  IF v_prev IS NOT NULL AND v_new <= v_prev THEN
    RAISE EXCEPTION 'Move it after the session before it';
  END IF;

  IF v_next IS NOT NULL AND v_new >= v_next THEN
    RAISE EXCEPTION 'Move it before the session after it';
  END IF;

  -- Guarded in the statement as well: the cron generator does not lock the
  -- campaign row, and it inserts the session and stamps the occurrence in one
  -- transaction, so re-checking at statement time sees both or neither rather
  -- than moving a session someone is already waiting in.
  UPDATE public.campaign_occurrences
  SET local_date = p_local_date, local_time = p_local_time
  WHERE id = p_occurrence_id
    AND status = 'planned'
    AND session_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session already scheduled';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'occurrence_id', p_occurrence_id,
    'local_date', p_local_date,
    'local_time', p_local_time
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reschedule_campaign_occurrence(uuid, date, time)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reschedule_campaign_occurrence(uuid, date, time)
  TO authenticated;
