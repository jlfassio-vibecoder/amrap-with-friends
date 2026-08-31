-- Local fixtures for run_campaign_scheduler (run after replaying migrations).
-- Requires: auth.users + athlete_profiles host row, and SET ROLE / jwt for nothing
-- (scheduler is SECURITY DEFINER and takes no auth.uid()).
--
-- Evidence targets:
--   1. In-window planned → one waiting mission + generated occurrence
--   2. Second tick is idempotent (no second mission)
--   3. Past late window → skipped
--   4. Finished mission → occurrence done

-- Setup (adjust ids if needed)
DO $$
DECLARE
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_campaign uuid;
  v_occ_in uuid;
  v_occ_late uuid;
  v_mission_count int;
BEGIN
  -- Assume host already exists in auth.users + athlete_profiles.

  INSERT INTO public.campaigns (
    id, host_user_id, name, week_count, missions_per_week,
    start_date, timezone, status, invite_code
  )
  VALUES (
    gen_random_uuid(), v_host, 'Scheduler fixture', 2, 1,
    current_date, 'UTC', 'active', 'FIX123'
  )
  RETURNING id INTO v_campaign;

  INSERT INTO public.campaign_members (campaign_id, user_id, role, status)
  VALUES (v_campaign, v_host, 'host', 'active');

  -- Due ~5 minutes from now → inside generate window.
  INSERT INTO public.campaign_occurrences (
    campaign_id, sequence, week_number, slot_number,
    local_date, local_time, duration_minutes, workout, status
  )
  VALUES (
    v_campaign, 1, 1, 1,
    (now() AT TIME ZONE 'UTC')::date,
    ((now() AT TIME ZONE 'UTC') + interval '5 minutes')::time,
    10,
    '[{"name":"Air Squats","target":10}]'::jsonb,
    'planned'
  )
  RETURNING id INTO v_occ_in;

  -- Due ~10 minutes ago → should skip.
  INSERT INTO public.campaign_occurrences (
    campaign_id, sequence, week_number, slot_number,
    local_date, local_time, duration_minutes, workout, status
  )
  VALUES (
    v_campaign, 2, 1, 1,
    (now() AT TIME ZONE 'UTC')::date,
    ((now() AT TIME ZONE 'UTC') - interval '10 minutes')::time,
    10,
    '[{"name":"Air Squats","target":10}]'::jsonb,
    'planned'
  )
  RETURNING id INTO v_occ_late;

  PERFORM public.run_campaign_scheduler();
  PERFORM public.run_campaign_scheduler(); -- idempotent

  SELECT count(*) INTO v_mission_count
  FROM public.missions
  WHERE campaign_occurrence_id = v_occ_in;

  IF v_mission_count <> 1 THEN
    RAISE EXCEPTION 'expected exactly one mission for in-window occ, got %', v_mission_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.missions
    WHERE campaign_occurrence_id = v_occ_in AND state = 'waiting' AND started_at IS NULL
  ) THEN
    RAISE EXCEPTION 'generated mission must stay waiting';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.campaign_occurrences
    WHERE id = v_occ_in AND status = 'generated' AND mission_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'in-window occurrence should be generated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.campaign_occurrences
    WHERE id = v_occ_late AND status = 'skipped'
  ) THEN
    RAISE EXCEPTION 'late occurrence should be skipped';
  END IF;

  UPDATE public.missions
  SET state = 'finished', time_left_sec = 0
  WHERE campaign_occurrence_id = v_occ_in;

  PERFORM public.run_campaign_scheduler();

  IF NOT EXISTS (
    SELECT 1 FROM public.campaign_occurrences
    WHERE id = v_occ_in AND status = 'done'
  ) THEN
    RAISE EXCEPTION 'finished mission should mark occurrence done';
  END IF;

  RAISE NOTICE 'campaign scheduler fixtures passed for campaign %', v_campaign;
END;
$$;
