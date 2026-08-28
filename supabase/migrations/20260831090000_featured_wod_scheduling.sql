-- Featured WOD phase 1: recurring schedule + the scheduling engine that
-- generates and auto-starts sessions from it. Backend only — no public
-- surfacing yet (that's phase 2). A coach picks a published coach_workouts
-- row, a set of local times, and days of week; a per-minute cron tick
-- turns that rule into real `sessions` rows ahead of time and flips them
-- from waiting to work once their scheduled time arrives, since sessions
-- are otherwise only ever advanced by whoever holds the host_token in
-- their browser — nobody would be present to start these automatically.
--
-- Design choices locked in with the user:
--   - One active schedule app-wide at a time (partial unique index below).
--   - Each coach has at most one schedule row, edited in place (unique on
--     created_by) — "pause" flips active=false without deleting it.
--   - Missed occurrences are skipped, not backfilled: the generator only
--     creates a session within a tight window around its scheduled time
--     (2 minutes late .. 15 minutes early), so a cron gap just drops that
--     one occurrence rather than creating it hours late.
--   - Timezone is captured on the schedule itself (validated against
--     pg_timezone_names, same as create_session's existing rally path).
--   - Uncapped participants, same as a normal session.

CREATE TABLE IF NOT EXISTS public.featured_wod_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  coach_workout_id uuid NOT NULL REFERENCES public.coach_workouts (id) ON DELETE CASCADE,
  days_of_week int[] NOT NULL,
  times_local text[] NOT NULL,
  timezone text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT featured_wod_schedules_days_length CHECK (
    array_length(days_of_week, 1) BETWEEN 1 AND 7
  ),
  CONSTRAINT featured_wod_schedules_times_length CHECK (
    array_length(times_local, 1) BETWEEN 1 AND 4
  )
);

-- One schedule per coach, edited in place via upsert.
CREATE UNIQUE INDEX IF NOT EXISTS featured_wod_schedules_created_by_uidx
  ON public.featured_wod_schedules (created_by);

-- One active schedule app-wide: a unique index on a constant expression,
-- filtered to active rows, so a second active=true row is impossible.
CREATE UNIQUE INDEX IF NOT EXISTS featured_wod_schedules_single_active_uidx
  ON public.featured_wod_schedules ((true))
  WHERE active = true;

ALTER TABLE public.featured_wod_schedules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.featured_wod_schedules FROM PUBLIC, anon, authenticated;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS featured_schedule_id uuid NULL
    REFERENCES public.featured_wod_schedules (id) ON DELETE SET NULL;

-- Guards the generator against double-inserting the same occurrence under
-- concurrent cron ticks.
CREATE UNIQUE INDEX IF NOT EXISTS sessions_featured_schedule_time_uidx
  ON public.sessions (featured_schedule_id, scheduled_at)
  WHERE featured_schedule_id IS NOT NULL;

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

CREATE OR REPLACE FUNCTION public.coach_get_featured_schedule()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'schedule', (
      SELECT jsonb_build_object(
        'id', fs.id,
        'coachWorkoutId', fs.coach_workout_id,
        'workoutName', cw.name,
        'daysOfWeek', to_jsonb(fs.days_of_week),
        'timesLocal', to_jsonb(fs.times_local),
        'timezone', fs.timezone,
        'active', fs.active,
        'updatedAt', fs.updated_at
      )
      FROM public.featured_wod_schedules fs
      JOIN public.coach_workouts cw ON cw.id = fs.coach_workout_id
      WHERE fs.created_by = v_uid
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_get_featured_schedule() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_get_featured_schedule() TO authenticated;

CREATE OR REPLACE FUNCTION public.coach_pause_featured_schedule()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.featured_wod_schedules
  SET active = false, updated_at = now()
  WHERE created_by = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_pause_featured_schedule() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_pause_featured_schedule() TO authenticated;

CREATE OR REPLACE FUNCTION public.coach_delete_featured_schedule()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.featured_wod_schedules WHERE created_by = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_delete_featured_schedule() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_delete_featured_schedule() TO authenticated;

-- The scheduling engine. Not user-invoked — called only by the pg_cron
-- job below (or manually by an operator) — so it takes no auth.uid() and
-- is revoked from every API role.
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
END;
$$;

REVOKE EXECUTE ON FUNCTION public.run_featured_wod_scheduler() FROM PUBLIC, anon, authenticated;

-- Wire the per-minute cron tick, if pg_cron is available (it is on
-- Supabase; guarded here so local/CI Postgres instances without the
-- extension can still replay this migration). cron.schedule() upserts by
-- job name, so re-running this migration is idempotent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron';
    PERFORM cron.schedule(
      'featured-wod-scheduler',
      '* * * * *',
      'SELECT public.run_featured_wod_scheduler();'
    );
  END IF;
END;
$$;
