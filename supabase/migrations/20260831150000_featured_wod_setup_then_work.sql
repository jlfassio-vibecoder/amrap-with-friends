-- Featured WOD: real 10s setup then full work clock (hostless).
--
-- Previously auto-start flipped waiting -> work without resetting
-- time_left_sec (still 10 from create). Joiners showed WORK 0:10 /
-- Elapsed 14:50 and froze because nobody pushes ticks.
--
-- Now: wall-clock setup window (scheduled_at .. +10s), then work with
-- started_at = scheduled_at + 10s and time_left derived from duration.
-- Stuck autofinish expected end includes the setup offset.

CREATE OR REPLACE FUNCTION public.run_featured_wod_scheduler()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_schedule RECORD;
  v_workout RECORD;
  v_today date;
  v_dow int;
  v_time text;
  v_scheduled_at timestamptz;
  v_session_id uuid;
  v_host_nickname text;
  v_workout_json jsonb;
  -- Matches client DEFAULT_SETUP_DURATION_SEC / featured setup clock.
  v_setup_sec int := 10;
BEGIN
  FOR v_schedule IN
    SELECT * FROM public.featured_wod_schedules WHERE active = true
  LOOP
    SELECT * INTO v_workout
    FROM public.coach_workouts
    WHERE id = v_schedule.coach_workout_id AND status = 'published';

    -- Coach unpublished/deleted the linked workout since scheduling it:
    -- skip generation this tick rather than erroring the whole job.
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_today := (now() AT TIME ZONE v_schedule.timezone)::date;
    v_dow := EXTRACT(DOW FROM v_today)::int;

    IF NOT (v_dow = ANY (v_schedule.days_of_week)) THEN
      CONTINUE;
    END IF;

    v_workout_json := (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'name', m ->> 'name',
        'target', CASE WHEN m ? 'target' THEN (m ->> 'target')::numeric ELSE NULL END,
        'unit', m ->> 'unit'
      )), '[]'::jsonb)
      FROM jsonb_array_elements(v_workout.movements) m
    );

    v_host_nickname := coalesce(
      (SELECT nickname FROM public.athlete_profiles WHERE user_id = v_schedule.created_by),
      'Coach'
    );

    FOREACH v_time IN ARRAY v_schedule.times_local LOOP
      v_scheduled_at := (v_today::text || ' ' || v_time)::timestamp AT TIME ZONE v_schedule.timezone;

      -- Generation window: up to 15 minutes early (so the lobby exists
      -- before start) but no more than 2 minutes late (skip, don't
      -- backfill, if a cron gap caused us to miss it).
      IF v_scheduled_at < now() - interval '2 minutes'
         OR v_scheduled_at > now() + interval '15 minutes'
      THEN
        CONTINUE;
      END IF;

      v_session_id := NULL;

      INSERT INTO public.sessions (
        host_token, duration_minutes, workout, template_id, intensity_tier,
        state, time_left_sec, scheduled_at, is_featured, featured_schedule_id
      )
      VALUES (
        gen_random_uuid()::text,
        v_workout.duration_minutes,
        v_workout_json,
        'coach:' || v_workout.id::text,
        v_workout.intensity_tier,
        'waiting',
        v_setup_sec,
        v_scheduled_at,
        true,
        v_schedule.id
      )
      ON CONFLICT (featured_schedule_id, scheduled_at) WHERE featured_schedule_id IS NOT NULL
      DO NOTHING
      RETURNING id INTO v_session_id;

      IF v_session_id IS NOT NULL THEN
        INSERT INTO public.participants (session_id, nickname, role, user_id)
        VALUES (v_session_id, v_host_nickname, 'host', v_schedule.created_by);
      END IF;
    END LOOP;
  END LOOP;

  -- Setup window: scheduled_at .. scheduled_at + setup. Nobody holds
  -- host_token, so the scheduler owns phase transitions. Recompute
  -- time_left each tick from wall clock (cron is per-minute).
  UPDATE public.sessions
  SET
    state = 'setup',
    started_at = NULL,
    is_paused = false,
    time_left_sec = GREATEST(
      1,
      CEIL(EXTRACT(EPOCH FROM (scheduled_at + (v_setup_sec * interval '1 second') - now())))
    )::int
  WHERE is_featured = true
    AND state IN ('waiting', 'setup')
    AND scheduled_at IS NOT NULL
    AND scheduled_at <= now()
    AND scheduled_at + (v_setup_sec * interval '1 second') > now();

  -- Work window: after setup. started_at is the end of setup (not now()),
  -- so the full duration_minutes clock starts only once get-ready ends.
  UPDATE public.sessions
  SET
    state = 'work',
    is_paused = false,
    started_at = scheduled_at + (v_setup_sec * interval '1 second'),
    time_left_sec = GREATEST(
      0,
      (duration_minutes * 60)
        - FLOOR(
          EXTRACT(
            EPOCH FROM (now() - (scheduled_at + (v_setup_sec * interval '1 second')))
          )
        )::int
    )
  WHERE is_featured = true
    AND state IN ('waiting', 'setup', 'work')
    AND scheduled_at IS NOT NULL
    AND scheduled_at + (v_setup_sec * interval '1 second') <= now()
    AND scheduled_at
      + (v_setup_sec * interval '1 second')
      + (duration_minutes * interval '1 minute')
      > now();

  -- Stuck-session safety valve: force-finish anything still "work" well
  -- past expected end (setup + duration), so it can no longer mask later
  -- occurrences on the public card.
  UPDATE public.sessions
  SET state = 'finished', is_paused = false, time_left_sec = 0, started_at = NULL
  WHERE is_featured = true
    AND state IN ('setup', 'work')
    AND scheduled_at IS NOT NULL
    AND scheduled_at
      + (v_setup_sec * interval '1 second')
      + (duration_minutes * interval '1 minute')
      + interval '30 minutes'
      <= now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.run_featured_wod_scheduler() FROM PUBLIC, anon, authenticated;
