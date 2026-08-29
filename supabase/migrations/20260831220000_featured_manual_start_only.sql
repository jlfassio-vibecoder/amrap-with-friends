-- Featured WOD: do not auto-enter setup/work from scheduled_at.
-- Sessions stay waiting until the host/coach presses Start. Keep materialize
-- + finish for sessions that actually reached work, and a stuck valve for
-- abandoned waiting rows long after the schedule window.

CREATE OR REPLACE FUNCTION public.run_featured_wod_scheduler()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_schedule RECORD;
  v_workout RECORD;
  v_day date;
  v_dow int;
  v_time text;
  v_scheduled_at timestamptz;
  v_session_id uuid;
  v_host_nickname text;
  v_workout_json jsonb;
  v_setup_sec int := 10;
  i int;
BEGIN
  FOR v_schedule IN
    SELECT * FROM public.featured_wod_schedules WHERE active = true
  LOOP
    SELECT * INTO v_workout
    FROM public.coach_workouts
    WHERE id = v_schedule.coach_workout_id AND status = 'published';

    IF NOT FOUND THEN
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

    FOR i IN 0..7 LOOP
      v_day := (now() AT TIME ZONE v_schedule.timezone)::date + i;
      v_dow := EXTRACT(DOW FROM v_day)::int;

      IF NOT (v_dow = ANY (v_schedule.days_of_week)) THEN
        CONTINUE;
      END IF;

      FOREACH v_time IN ARRAY v_schedule.times_local LOOP
        v_scheduled_at := (v_day::text || ' ' || v_time)::timestamp AT TIME ZONE v_schedule.timezone;

        IF v_scheduled_at < now() - interval '2 minutes' THEN
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
  END LOOP;

  -- Finish work using the host Start anchor (started_at), not scheduled_at.
  UPDATE public.sessions
  SET state = 'finished', is_paused = false, time_left_sec = 0
  WHERE is_featured = true
    AND state = 'work'
    AND started_at IS NOT NULL
    AND started_at + (duration_minutes * interval '1 minute') <= now();

  -- Abandoned waiting/setup long after the schedule window.
  UPDATE public.sessions
  SET state = 'finished', is_paused = false, time_left_sec = 0, started_at = NULL
  WHERE is_featured = true
    AND state IN ('waiting', 'setup')
    AND scheduled_at IS NOT NULL
    AND scheduled_at
      + (v_setup_sec * interval '1 second')
      + (duration_minutes * interval '1 minute')
      + interval '30 minutes'
      <= now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.run_featured_wod_scheduler() FROM PUBLIC, anon, authenticated;
