-- Featured WOD phase 2: the public-facing RPC. Unlike every other coach_*
-- RPC in this app, this one is intentionally granted to `anon` — it has to
-- render on the signed-out landing page. It exposes only the same
-- non-sensitive fields list_published_coach_workouts already shows any
-- signed-in user (name/focus/duration/intensity/tags), never movements or
-- linked-exercise detail, and never anything about the coach.

-- Scans up to 8 days ahead (today + 0..7) in the schedule's own timezone
-- for the nearest future occurrence, so the landing/create page can still
-- show "next" time even before the scheduler has generated that day's
-- session (generation only happens within its 15-minute lead window).
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
      IF v_candidate > now() - interval '2 minutes'
         AND (v_best IS NULL OR v_candidate < v_best)
      THEN
        v_best := v_candidate;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_best;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.featured_wod_next_occurrence(public.featured_wod_schedules)
  FROM PUBLIC, anon, authenticated;

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

  -- Coach unpublished/deleted the workout since scheduling it: treat as
  -- nothing featured rather than surfacing stale/inaccessible content.
  IF NOT FOUND OR v_workout.status <> 'published' THEN
    RETURN jsonb_build_object('ok', true, 'featured', NULL);
  END IF;

  -- A generated, still-live occurrence takes priority over the computed
  -- "next" time — this is what makes the card show a real, joinable
  -- session once the scheduler has created it.
  SELECT id, scheduled_at, state
  INTO v_session
  FROM public.sessions
  WHERE featured_schedule_id = v_schedule.id AND state IN ('waiting', 'work')
  ORDER BY scheduled_at ASC
  LIMIT 1;

  IF FOUND THEN
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
        'state', v_session.state
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
      'state', NULL
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.current_featured_wod() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_featured_wod() TO anon, authenticated;
