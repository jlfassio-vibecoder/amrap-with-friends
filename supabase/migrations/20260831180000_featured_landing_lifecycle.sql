-- Featured WOD landing lifecycle:
-- 1) My-sessions "delete" of a featured occurrence finishes it (keeps the
--    unique schedule+time slot so cron cannot regenerate it).
-- 2) current_featured_wod returns setup/work/started_at; skips early-cancelled
--    (cancelled) rows; surfaces naturally-ended finished rows briefly.
-- 3) Scheduler finishes work at scheduled_at + 10s + duration (not only +30m).

CREATE OR REPLACE FUNCTION public.delete_incomplete_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_segment_index int;
  v_is_featured boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'Session id is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.participants p
    WHERE p.session_id = p_session_id
      AND p.user_id = v_uid
      AND p.role = 'host'
  ) THEN
    RAISE EXCEPTION 'Only the host can delete this session';
  END IF;

  SELECT s.segment_index, s.is_featured
  INTO v_segment_index, v_is_featured
  FROM public.sessions s
  WHERE s.id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.participants p
    INNER JOIN public.participant_segment_results psr
      ON psr.participant_id = p.id
     AND psr.segment_index = v_segment_index
    WHERE p.session_id = p_session_id
      AND psr.score_breakdown IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Completed sessions cannot be deleted';
  END IF;

  -- Featured: finish in place so (featured_schedule_id, scheduled_at) stays
  -- occupied and run_featured_wod_scheduler cannot recreate the occurrence.
  IF v_is_featured THEN
    UPDATE public.sessions
    SET
      state = 'finished',
      is_paused = false,
      time_left_sec = 0,
      started_at = NULL
    WHERE id = p_session_id;

    RETURN jsonb_build_object('ok', true, 'cancelledFeatured', true);
  END IF;

  DELETE FROM public.sessions
  WHERE id = p_session_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_incomplete_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_incomplete_session(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.current_featured_wod()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_schedule public.featured_wod_schedules%ROWTYPE;
  v_workout public.coach_workouts%ROWTYPE;
  v_session RECORD;
  v_next timestamptz;
  v_attendee_count int;
  v_setup_sec int := 10;
BEGIN
  SELECT * INTO v_schedule
  FROM public.featured_wod_schedules
  WHERE active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'featured', NULL);
  END IF;

  SELECT * INTO v_workout
  FROM public.coach_workouts
  WHERE id = v_schedule.coach_workout_id;

  IF NOT FOUND OR v_workout.status <> 'published' THEN
    RETURN jsonb_build_object('ok', true, 'featured', NULL);
  END IF;

  -- Prefer an active / upcoming generated session (includes setup).
  SELECT id, scheduled_at, state, started_at
  INTO v_session
  FROM public.sessions
  WHERE featured_schedule_id = v_schedule.id
    AND state IN ('waiting', 'setup', 'work')
  ORDER BY scheduled_at ASC
  LIMIT 1;

  -- Else surface a naturally-ended occurrence briefly (work window over),
  -- so the card can show "AMRAP ended." Coach-cancelled rows finished
  -- before work end are skipped → fall through to next-occurrence preview.
  IF NOT FOUND THEN
    SELECT id, scheduled_at, state, started_at
    INTO v_session
    FROM public.sessions
    WHERE featured_schedule_id = v_schedule.id
      AND state = 'finished'
      AND scheduled_at IS NOT NULL
      AND scheduled_at
        + (v_setup_sec * interval '1 second')
        + (duration_minutes * interval '1 minute')
        <= now()
      AND scheduled_at
        + (v_setup_sec * interval '1 second')
        + (duration_minutes * interval '1 minute')
        + interval '2 hours'
        > now()
    ORDER BY scheduled_at DESC
    LIMIT 1;
  END IF;

  IF FOUND THEN
    SELECT count(*)::int INTO v_attendee_count
    FROM public.participants
    WHERE session_id = v_session.id;

    RETURN jsonb_build_object(
      'ok', true,
      'featured', jsonb_build_object(
        'workoutName', v_workout.name,
        'focus', v_workout.focus,
        'durationMinutes', v_workout.duration_minutes,
        'intensityTier', v_workout.intensity_tier,
        'tags', to_jsonb(v_workout.tags),
        'scheduledAt', v_session.scheduled_at,
        'sessionId', v_session.id,
        'state', v_session.state,
        'startedAt', v_session.started_at,
        'attendeeCount', v_attendee_count
      )
    );
  END IF;

  v_next := public.featured_wod_next_occurrence(v_schedule);
  IF v_next IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'featured', NULL);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'featured', jsonb_build_object(
      'workoutName', v_workout.name,
      'focus', v_workout.focus,
      'durationMinutes', v_workout.duration_minutes,
      'intensityTier', v_workout.intensity_tier,
      'tags', to_jsonb(v_workout.tags),
      'scheduledAt', v_next,
      'sessionId', NULL,
      'state', NULL,
      'startedAt', NULL,
      'attendeeCount', NULL
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.current_featured_wod() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_featured_wod() TO anon, authenticated;

-- Replace scheduler body to finish work on time (keep create + setup/work + stuck valve).
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
  v_setup_sec int := 10;
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

  -- Finish when the real AMRAP duration completes (after setup).
  UPDATE public.sessions
  SET state = 'finished', is_paused = false, time_left_sec = 0, started_at = NULL
  WHERE is_featured = true
    AND state = 'work'
    AND scheduled_at IS NOT NULL
    AND scheduled_at
      + (v_setup_sec * interval '1 second')
      + (duration_minutes * interval '1 minute')
      <= now();

  -- Stuck-session safety valve for abandoned setup/waiting past grace.
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
