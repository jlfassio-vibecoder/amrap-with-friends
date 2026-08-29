-- Featured WOD phase 3: attendee count on the public card. Redefines
-- current_featured_wod() to include how many participants have already
-- joined the generated session, so the landing/create page can show
-- "6 joining" rather than just a bare time. Null (not 0) whenever there's
-- no generated session yet, so the client can distinguish "nobody's
-- joined the still-empty lobby" from "not joinable yet".
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

  SELECT id, scheduled_at, state
  INTO v_session
  FROM public.sessions
  WHERE featured_schedule_id = v_schedule.id AND state IN ('waiting', 'work')
  ORDER BY scheduled_at ASC
  LIMIT 1;

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
      'attendeeCount', NULL
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.current_featured_wod() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_featured_wod() TO anon, authenticated;
