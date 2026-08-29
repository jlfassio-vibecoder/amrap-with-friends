-- Featured WOD phase 4 P2: stuck-session safety valve.
--
-- current_featured_wod() picks the earliest still-unfinished
-- (waiting/work) featured session. Nothing ever force-finishes a
-- session today, so if a coach starts a featured WOD and then isn't
-- around to end it (or simply forgets), it sits in 'work' forever —
-- permanently masking every later occurrence on the public card, since
-- the query always surfaces the oldest unfinished one first.
--
-- This adds a grace-window auto-finish to the existing scheduler tick:
-- any featured session still 'work' more than 30 minutes past its
-- expected end (scheduled_at + duration_minutes) gets force-finished.
-- 30 minutes is a deliberately generous buffer over the workout's own
-- duration — this is a dead-session cleanup, not a real-time cutoff,
-- and should never fire while an athlete is still legitimately
-- finishing up. Mirrors the field set update_session_state() uses for a
-- manual finish (time_left_sec/is_paused/started_at all reset), so nothing
-- downstream needs a stuck-vs-manual distinction.
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
        10,
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

  -- Auto-start: nobody holds this session's host_token in a browser, so
  -- the scheduler itself flips waiting -> work once the time arrives.
  UPDATE public.sessions
  SET state = 'work', started_at = now()
  WHERE is_featured = true AND state = 'waiting' AND scheduled_at <= now();

  -- Stuck-session safety valve: force-finish anything still "work" well
  -- past its expected end, so it can no longer mask later occurrences on
  -- the public card. Only touches featured sessions — never a regular
  -- host-created one, which stays whatever the host left it as.
  UPDATE public.sessions
  SET state = 'finished', is_paused = false, time_left_sec = 0, started_at = NULL
  WHERE is_featured = true
    AND state = 'work'
    AND scheduled_at + (duration_minutes * interval '1 minute') + interval '30 minutes' <= now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.run_featured_wod_scheduler() FROM PUBLIC, anon, authenticated;
