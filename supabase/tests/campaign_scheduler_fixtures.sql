-- Local fixtures for run_campaign_scheduler (run after replaying migrations).
-- Requires: auth.users + athlete_profiles host row.
--
-- Evidence targets:
--   1. In-window planned → one waiting mission + generated occurrence
--   2. Second tick is idempotent (no second mission)
--   3. Past late window → skipped
--   4. update_mission_state preserves started_at through finished → done
--   5. Finished never-started (null started_at, no work) → skipped
--   6. Finished with null started_at but a scored result → done (repair path)

DO $$
DECLARE
  v_host uuid := '11111111-1111-1111-1111-111111111111';
  v_campaign uuid;
  v_occ_in uuid;
  v_occ_late uuid;
  v_occ_never uuid;
  v_occ_scored uuid;
  v_mission_in uuid;
  v_mission_never uuid;
  v_mission_scored uuid;
  v_participant uuid;
  v_host_token text;
  v_started timestamptz := '2026-09-06T12:00:00Z';
  v_mission_count int;
  v_state jsonb;
BEGIN
  INSERT INTO public.campaigns (
    id, host_user_id, name, week_count, missions_per_week,
    start_date, timezone, status, invite_code
  )
  VALUES (
    gen_random_uuid(), v_host, 'Scheduler fixture', 4, 1,
    current_date, 'UTC', 'active', upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
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

  -- Due ~10 minutes ago → should skip (never generated).
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

  -- Extra in-window rows for never-started and scored-evidence cases.
  INSERT INTO public.campaign_occurrences (
    campaign_id, sequence, week_number, slot_number,
    local_date, local_time, duration_minutes, workout, status
  )
  VALUES (
    v_campaign, 3, 2, 1,
    (now() AT TIME ZONE 'UTC')::date,
    ((now() AT TIME ZONE 'UTC') + interval '6 minutes')::time,
    10,
    '[{"name":"Air Squats","target":10}]'::jsonb,
    'planned'
  )
  RETURNING id INTO v_occ_never;

  INSERT INTO public.campaign_occurrences (
    campaign_id, sequence, week_number, slot_number,
    local_date, local_time, duration_minutes, workout, status
  )
  VALUES (
    v_campaign, 4, 2, 1,
    (now() AT TIME ZONE 'UTC')::date,
    ((now() AT TIME ZONE 'UTC') + interval '7 minutes')::time,
    10,
    '[{"name":"Air Squats","target":10}]'::jsonb,
    'planned'
  )
  RETURNING id INTO v_occ_scored;

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

  IF NOT EXISTS (
    SELECT 1 FROM public.campaign_occurrences
    WHERE id = v_occ_never AND status = 'generated'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.campaign_occurrences
    WHERE id = v_occ_scored AND status = 'generated'
  ) THEN
    RAISE EXCEPTION 'extra in-window occurrences should be generated';
  END IF;

  SELECT id, host_token INTO v_mission_in, v_host_token
  FROM public.missions
  WHERE campaign_occurrence_id = v_occ_in;

  -- Host Start → work, then finish; started_at must survive finished.
  v_state := public.update_mission_state(
    v_mission_in, v_host_token, 'work', 600, false, v_started
  );
  IF (v_state ->> 'started_at')::timestamptz IS DISTINCT FROM v_started THEN
    RAISE EXCEPTION 'work should set started_at';
  END IF;

  v_state := public.update_mission_state(
    v_mission_in, v_host_token, 'finished', 0, false, NULL
  );
  IF (v_state ->> 'started_at')::timestamptz IS DISTINCT FROM v_started THEN
    RAISE EXCEPTION 'finished must preserve started_at, got %', v_state ->> 'started_at';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.missions
    WHERE id = v_mission_in AND state = 'finished' AND started_at = v_started
  ) THEN
    RAISE EXCEPTION 'mission row must keep started_at after finish';
  END IF;

  PERFORM public.run_campaign_scheduler();

  IF NOT EXISTS (
    SELECT 1 FROM public.campaign_occurrences
    WHERE id = v_occ_in AND status = 'done'
  ) THEN
    RAISE EXCEPTION 'finished mission with started_at should mark occurrence done';
  END IF;

  -- Never-started finished mission → skipped.
  SELECT id INTO v_mission_never
  FROM public.missions
  WHERE campaign_occurrence_id = v_occ_never;

  UPDATE public.missions
  SET state = 'finished', time_left_sec = 0, started_at = NULL
  WHERE id = v_mission_never;

  PERFORM public.run_campaign_scheduler();

  IF NOT EXISTS (
    SELECT 1 FROM public.campaign_occurrences
    WHERE id = v_occ_never AND status = 'skipped'
  ) THEN
    RAISE EXCEPTION 'never-started finished mission should be skipped';
  END IF;

  -- Null started_at but scored result → done (evidence / repair path).
  SELECT m.id, p.id
  INTO v_mission_scored, v_participant
  FROM public.missions m
  INNER JOIN public.participants p ON p.mission_id = m.id AND p.role = 'host'
  WHERE m.campaign_occurrence_id = v_occ_scored;

  UPDATE public.missions
  SET state = 'finished', time_left_sec = 0, started_at = NULL
  WHERE id = v_mission_scored;

  INSERT INTO public.participant_segment_results (
    participant_id, segment_index, final_score
  )
  VALUES (v_participant, 0, 100);

  -- Misclassify as skipped first, then scheduler repair must flip to done.
  UPDATE public.campaign_occurrences
  SET status = 'skipped'
  WHERE id = v_occ_scored;

  PERFORM public.run_campaign_scheduler();

  IF NOT EXISTS (
    SELECT 1 FROM public.campaign_occurrences
    WHERE id = v_occ_scored AND status = 'done'
  ) THEN
    RAISE EXCEPTION 'scored finished mission should repair to done';
  END IF;

  RAISE NOTICE 'campaign scheduler fixtures passed for campaign %', v_campaign;
END;
$$;
