-- Featured occurrences visible in My Sessions:
-- 1) Materialize the next 8 days of schedule slots (not only the 15-minute
--    lead window) so the coach host row appears immediately.
-- 2) next_occurrence skips slots that already have a session (including
--    cancelled/finished), so delete-one-day cannot resurface as a preview.
-- 3) Saving a schedule runs the scheduler so My Sessions updates without
--    waiting for cron.
-- 4) my_sessions exposes scheduled_at + is_featured for UI copy.

CREATE OR REPLACE FUNCTION public.featured_wod_next_occurrence(
  p_schedule public.featured_wod_schedules
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_day date;
  v_dow int;
  v_time text;
  v_candidate timestamptz;
  v_best timestamptz := NULL;
  i int;
BEGIN
  FOR i IN 0..7 LOOP
    v_day := (now() AT TIME ZONE p_schedule.timezone)::date + i;
    v_dow := EXTRACT(DOW FROM v_day)::int;
    IF NOT (v_dow = ANY (p_schedule.days_of_week)) THEN
      CONTINUE;
    END IF;

    FOREACH v_time IN ARRAY p_schedule.times_local LOOP
      v_candidate := (v_day::text || ' ' || v_time)::timestamp AT TIME ZONE p_schedule.timezone;
      IF v_candidate <= now() - interval '2 minutes' THEN
        CONTINUE;
      END IF;
      -- Occupied slots (waiting, finished/cancelled, etc.) are not "next".
      IF EXISTS (
        SELECT 1
        FROM public.sessions s
        WHERE s.featured_schedule_id = p_schedule.id
          AND s.scheduled_at = v_candidate
      ) THEN
        CONTINUE;
      END IF;
      IF v_best IS NULL OR v_candidate < v_best THEN
        v_best := v_candidate;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_best;
END;
$$;

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

    -- Create hostable sessions for every schedule slot in the next 8 days
    -- (same horizon as featured_wod_next_occurrence), so My Sessions lists
    -- upcoming occurrences. ON CONFLICT keeps cancelled/finished slots from
    -- being regenerated.
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

  UPDATE public.sessions
  SET state = 'finished', is_paused = false, time_left_sec = 0, started_at = NULL
  WHERE is_featured = true
    AND state = 'work'
    AND scheduled_at IS NOT NULL
    AND scheduled_at
      + (v_setup_sec * interval '1 second')
      + (duration_minutes * interval '1 minute')
      <= now();

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

CREATE OR REPLACE FUNCTION public.coach_set_featured_schedule(
  p_coach_workout_id uuid,
  p_days_of_week int[],
  p_times_local text[],
  p_timezone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_workout public.coach_workouts%ROWTYPE;
  v_days int[];
  v_times text[];
  v_time text;
  v_tz text;
  v_row public.featured_wod_schedules%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_workout
  FROM public.coach_workouts
  WHERE id = p_coach_workout_id AND created_by = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workout not found';
  END IF;
  IF v_workout.status <> 'published' THEN
    RAISE EXCEPTION 'Only a published workout can be featured';
  END IF;
  IF v_workout.duration_minutes > 60 THEN
    RAISE EXCEPTION 'Featured workouts must be 60 minutes or less';
  END IF;
  IF jsonb_array_length(v_workout.movements) > 20 THEN
    RAISE EXCEPTION 'Featured workouts are limited to 20 movements';
  END IF;

  IF p_days_of_week IS NULL OR array_length(p_days_of_week, 1) IS NULL
     OR array_length(p_days_of_week, 1) > 7
  THEN
    RAISE EXCEPTION 'Choose at least one day';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_days_of_week) d WHERE d < 0 OR d > 6) THEN
    RAISE EXCEPTION 'Invalid day of week';
  END IF;
  SELECT array_agg(DISTINCT d ORDER BY d) INTO v_days FROM unnest(p_days_of_week) d;

  IF p_times_local IS NULL OR array_length(p_times_local, 1) IS NULL
     OR array_length(p_times_local, 1) > 4
  THEN
    RAISE EXCEPTION 'Choose 1 to 4 times per day';
  END IF;
  FOREACH v_time IN ARRAY p_times_local LOOP
    IF v_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
      RAISE EXCEPTION 'Times must be in HH:MM 24-hour format';
    END IF;
  END LOOP;
  SELECT array_agg(DISTINCT t ORDER BY t) INTO v_times FROM unnest(p_times_local) t;

  v_tz := btrim(coalesce(p_timezone, ''));
  IF v_tz = '' OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_tz) THEN
    RAISE EXCEPTION 'invalid_timezone';
  END IF;

  INSERT INTO public.featured_wod_schedules (
    created_by, coach_workout_id, days_of_week, times_local, timezone, active
  )
  VALUES (v_uid, p_coach_workout_id, v_days, v_times, v_tz, true)
  ON CONFLICT (created_by) DO UPDATE
  SET
    coach_workout_id = EXCLUDED.coach_workout_id,
    days_of_week = EXCLUDED.days_of_week,
    times_local = EXCLUDED.times_local,
    timezone = EXCLUDED.timezone,
    active = true,
    updated_at = now()
  RETURNING * INTO v_row;

  -- Materialize upcoming host rows so My Sessions lists them immediately.
  PERFORM public.run_featured_wod_scheduler();

  RETURN jsonb_build_object(
    'ok', true,
    'schedule', jsonb_build_object(
      'id', v_row.id,
      'coachWorkoutId', v_row.coach_workout_id,
      'daysOfWeek', to_jsonb(v_row.days_of_week),
      'timesLocal', to_jsonb(v_row.times_local),
      'timezone', v_row.timezone,
      'active', v_row.active,
      'updatedAt', v_row.updated_at
    )
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'A featured WOD is already scheduled by another coach. Ask them to pause it first.';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_set_featured_schedule(uuid, int[], text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_set_featured_schedule(uuid, int[], text[], text) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_sessions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_sessions jsonb;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'participant_id', p.id,
        'nickname', p.nickname,
        'joined_at', p.joined_at,
        'role', p.role,
        'session_id', s.id,
        'created_at', s.created_at,
        'scheduled_at', s.scheduled_at,
        'is_featured', coalesce(s.is_featured, false),
        'duration_minutes', s.duration_minutes,
        'workout', s.workout,
        'state', s.state,
        'segment_index', s.segment_index,
        'round_count', (
          SELECT count(*)::int
          FROM public.rounds r
          WHERE r.participant_id = p.id AND r.segment_index = s.segment_index
        ),
        'partial_reps', coalesce(psr.partial_reps, 0),
        'final_score', psr.final_score,
        'score_breakdown', psr.score_breakdown,
        'coach_workout_name', cw.name
      )
      ORDER BY coalesce(s.scheduled_at, s.created_at) DESC
    ),
    '[]'::jsonb
  )
  INTO v_sessions
  FROM public.participants p
  INNER JOIN public.sessions s ON s.id = p.session_id
  LEFT JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
    AND psr.segment_index = s.segment_index
  LEFT JOIN public.coach_workouts cw
    ON s.template_id = 'coach:' || cw.id::text
  WHERE p.user_id = v_uid
    -- Early-cancelled featured slots (finished with no score) stay out of
    -- the list; delete is one occurrence only and should not linger as a row.
    AND NOT (
      coalesce(s.is_featured, false)
      AND s.state = 'finished'
      AND psr.score_breakdown IS NULL
    );

  RETURN jsonb_build_object('ok', true, 'sessions', v_sessions);
END;
$$;
