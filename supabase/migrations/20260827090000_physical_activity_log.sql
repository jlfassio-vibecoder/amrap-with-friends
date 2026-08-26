-- Physical activity log: outside/self-reported training, logged by the
-- athlete. Does NOT contribute to weekly classification minutes (that
-- stays locked-AMRAP-only, per the HUD's verified-rank integrity model) —
-- this is a separate, honest ledger, used later (Phase B) as an input to
-- an overtraining/load-safety check alongside AMRAP session load.

-- Fixed, categorized activity taxonomy (mirrors src/data/activityTypes.ts —
-- keep both in sync by hand when adding activities). Readable by anyone
-- signed in; it's just a reference list, not user data.
CREATE TABLE IF NOT EXISTS public.activity_type_catalog (
  activity_type text PRIMARY KEY,
  activity_category text NOT NULL,
  label text NOT NULL
);

REVOKE ALL ON TABLE public.activity_type_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.activity_type_catalog TO authenticated;

INSERT INTO public.activity_type_catalog (activity_type, activity_category, label) VALUES
  ('run', 'running_walking', 'Run'),
  ('trail_run', 'running_walking', 'Trail Run'),
  ('treadmill_run', 'running_walking', 'Treadmill Run'),
  ('jog', 'running_walking', 'Jog'),
  ('walk', 'running_walking', 'Walk'),
  ('hike', 'running_walking', 'Hike'),

  ('road_bike', 'cycling', 'Road Bike'),
  ('mountain_bike', 'cycling', 'Mountain Bike'),
  ('e_mountain_bike', 'cycling', 'E-Mountain Bike'),
  ('e_bike', 'cycling', 'E-Bike'),
  ('cruiser_bike', 'cycling', 'Cruiser Bike'),
  ('gravel_bike', 'cycling', 'Gravel Bike'),
  ('bmx', 'cycling', 'BMX'),
  ('indoor_cycling', 'cycling', 'Indoor / Stationary Bike'),
  ('spin_class', 'cycling', 'Spin Class'),

  ('pool_swim', 'swimming_water', 'Pool Swim'),
  ('open_water_swim', 'swimming_water', 'Open Water Swim'),
  ('surfing', 'swimming_water', 'Surfing'),
  ('paddleboarding', 'swimming_water', 'Paddleboarding (SUP)'),
  ('kayaking', 'swimming_water', 'Kayaking'),
  ('rowing_water', 'swimming_water', 'Rowing (Water)'),
  ('water_polo', 'swimming_water', 'Water Polo'),
  ('water_skiing', 'swimming_water', 'Water Skiing'),

  ('weightlifting', 'strength_gym', 'Weightlifting'),
  ('powerlifting', 'strength_gym', 'Powerlifting'),
  ('bodyweight_training', 'strength_gym', 'Bodyweight Training'),
  ('circuit_training', 'strength_gym', 'Circuit Training'),
  ('functional_fitness', 'strength_gym', 'Functional Fitness'),

  ('yoga', 'mind_body', 'Yoga'),
  ('pilates', 'mind_body', 'Pilates'),
  ('stretching_mobility', 'mind_body', 'Stretching / Mobility'),
  ('tai_chi', 'mind_body', 'Tai Chi'),

  ('snowboarding', 'winter_sports', 'Snowboarding'),
  ('skiing_downhill', 'winter_sports', 'Skiing (Downhill)'),
  ('cross_country_skiing', 'winter_sports', 'Cross-Country Skiing'),
  ('ice_skating', 'winter_sports', 'Ice Skating'),
  ('snowshoeing', 'winter_sports', 'Snowshoeing'),

  ('tennis', 'racket_court_sports', 'Tennis'),
  ('pickleball', 'racket_court_sports', 'Pickleball'),
  ('badminton', 'racket_court_sports', 'Badminton'),
  ('table_tennis', 'racket_court_sports', 'Table Tennis'),
  ('squash', 'racket_court_sports', 'Squash'),
  ('racquetball', 'racket_court_sports', 'Racquetball'),

  ('basketball', 'team_field_sports', 'Basketball'),
  ('baseball', 'team_field_sports', 'Baseball'),
  ('softball', 'team_field_sports', 'Softball'),
  ('soccer', 'team_field_sports', 'Soccer'),
  ('football', 'team_field_sports', 'Football'),
  ('volleyball', 'team_field_sports', 'Volleyball'),
  ('ice_hockey', 'team_field_sports', 'Ice Hockey'),
  ('field_hockey', 'team_field_sports', 'Field Hockey'),
  ('lacrosse', 'team_field_sports', 'Lacrosse'),
  ('rugby', 'team_field_sports', 'Rugby'),
  ('cricket', 'team_field_sports', 'Cricket'),
  ('ultimate_frisbee', 'team_field_sports', 'Ultimate Frisbee'),

  ('boxing', 'combat_martial_arts', 'Boxing'),
  ('kickboxing', 'combat_martial_arts', 'Kickboxing'),
  ('brazilian_jiu_jitsu', 'combat_martial_arts', 'Brazilian Jiu-Jitsu'),
  ('judo', 'combat_martial_arts', 'Judo'),
  ('karate', 'combat_martial_arts', 'Karate'),
  ('wrestling', 'combat_martial_arts', 'Wrestling'),
  ('mma_training', 'combat_martial_arts', 'MMA Training'),

  ('rowing_machine', 'indoor_cardio', 'Rowing Machine'),
  ('elliptical', 'indoor_cardio', 'Elliptical'),
  ('stair_climber', 'indoor_cardio', 'Stair Climber'),
  ('jump_rope', 'indoor_cardio', 'Jump Rope'),

  ('golf', 'outdoor_adventure', 'Golf'),
  ('rock_climbing', 'outdoor_adventure', 'Rock Climbing'),
  ('skateboarding', 'outdoor_adventure', 'Skateboarding'),
  ('horseback_riding', 'outdoor_adventure', 'Horseback Riding'),

  ('other', 'other', 'Other')
ON CONFLICT (activity_type) DO NOTHING;

-- Log table. No client-role table grants at all — every read/write goes
-- through the RPCs below (same posture as athlete_profiles).
CREATE TABLE IF NOT EXISTS public.physical_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  activity_type text NOT NULL REFERENCES public.activity_type_catalog (activity_type),
  duration_minutes int NOT NULL,
  intensity_tier int NOT NULL,
  occurred_at timestamptz NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT physical_activity_log_duration_range CHECK (
    duration_minutes BETWEEN 1 AND 600
  ),
  CONSTRAINT physical_activity_log_intensity_range CHECK (
    intensity_tier BETWEEN 1 AND 5
  ),
  CONSTRAINT physical_activity_log_notes_length CHECK (
    notes IS NULL OR length(notes) <= 280
  ),
  CONSTRAINT physical_activity_log_occurred_not_future CHECK (
    occurred_at <= now() + interval '1 day'
  )
);

CREATE INDEX IF NOT EXISTS physical_activity_log_user_occurred_idx
  ON public.physical_activity_log (user_id, occurred_at DESC);

REVOKE ALL ON TABLE public.physical_activity_log FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_physical_activity(
  p_activity_type text,
  p_duration_minutes int,
  p_intensity_tier int,
  p_occurred_at timestamptz,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_notes text;
  v_row public.physical_activity_log%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.activity_type_catalog WHERE activity_type = p_activity_type
  ) THEN
    RAISE EXCEPTION 'Unknown activity type';
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes < 1 OR p_duration_minutes > 600 THEN
    RAISE EXCEPTION 'Duration must be between 1 and 600 minutes';
  END IF;

  IF p_intensity_tier IS NULL OR p_intensity_tier < 1 OR p_intensity_tier > 5 THEN
    RAISE EXCEPTION 'Intensity must be between 1 and 5';
  END IF;

  IF p_occurred_at IS NULL OR p_occurred_at > now() + interval '1 day' THEN
    RAISE EXCEPTION 'Activity date cannot be in the future';
  END IF;

  v_notes := nullif(btrim(coalesce(p_notes, '')), '');
  IF v_notes IS NOT NULL AND length(v_notes) > 280 THEN
    RAISE EXCEPTION 'Notes must be 280 characters or fewer';
  END IF;

  INSERT INTO public.physical_activity_log (
    user_id, activity_type, duration_minutes, intensity_tier, occurred_at, notes
  )
  VALUES (v_uid, p_activity_type, p_duration_minutes, p_intensity_tier, p_occurred_at, v_notes)
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'entry', jsonb_build_object(
      'id', v_row.id,
      'activityType', v_row.activity_type,
      'durationMinutes', v_row.duration_minutes,
      'intensityTier', v_row.intensity_tier,
      'occurredAt', v_row.occurred_at,
      'notes', v_row.notes,
      'createdAt', v_row.created_at
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_physical_activity(text, int, int, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_physical_activity(text, int, int, timestamptz, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_physical_activity(
  p_id uuid,
  p_activity_type text,
  p_duration_minutes int,
  p_intensity_tier int,
  p_occurred_at timestamptz,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_notes text;
  v_row public.physical_activity_log%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.activity_type_catalog WHERE activity_type = p_activity_type
  ) THEN
    RAISE EXCEPTION 'Unknown activity type';
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes < 1 OR p_duration_minutes > 600 THEN
    RAISE EXCEPTION 'Duration must be between 1 and 600 minutes';
  END IF;

  IF p_intensity_tier IS NULL OR p_intensity_tier < 1 OR p_intensity_tier > 5 THEN
    RAISE EXCEPTION 'Intensity must be between 1 and 5';
  END IF;

  IF p_occurred_at IS NULL OR p_occurred_at > now() + interval '1 day' THEN
    RAISE EXCEPTION 'Activity date cannot be in the future';
  END IF;

  v_notes := nullif(btrim(coalesce(p_notes, '')), '');
  IF v_notes IS NOT NULL AND length(v_notes) > 280 THEN
    RAISE EXCEPTION 'Notes must be 280 characters or fewer';
  END IF;

  UPDATE public.physical_activity_log
  SET
    activity_type = p_activity_type,
    duration_minutes = p_duration_minutes,
    intensity_tier = p_intensity_tier,
    occurred_at = p_occurred_at,
    notes = v_notes,
    updated_at = now()
  WHERE id = p_id AND user_id = v_uid
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'entry', jsonb_build_object(
      'id', v_row.id,
      'activityType', v_row.activity_type,
      'durationMinutes', v_row.duration_minutes,
      'intensityTier', v_row.intensity_tier,
      'occurredAt', v_row.occurred_at,
      'notes', v_row.notes,
      'createdAt', v_row.created_at
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_physical_activity(uuid, text, int, int, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_physical_activity(uuid, text, int, int, timestamptz, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_physical_activity(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_deleted uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  DELETE FROM public.physical_activity_log
  WHERE id = p_id AND user_id = v_uid
  RETURNING id INTO v_deleted;

  IF v_deleted IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_physical_activity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_physical_activity(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_physical_activity(p_limit int DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_limit int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_limit := LEAST(GREATEST(coalesce(p_limit, 50), 1), 200);

  RETURN jsonb_build_object(
    'ok', true,
    'entries', (
      SELECT coalesce(jsonb_agg(e ORDER BY e."occurredAt" DESC), '[]'::jsonb)
      FROM (
        SELECT
          pal.id,
          pal.activity_type AS "activityType",
          cat.activity_category AS "activityCategory",
          cat.label AS "activityLabel",
          pal.duration_minutes AS "durationMinutes",
          pal.intensity_tier AS "intensityTier",
          pal.occurred_at AS "occurredAt",
          pal.notes,
          pal.created_at AS "createdAt"
        FROM public.physical_activity_log pal
        JOIN public.activity_type_catalog cat ON cat.activity_type = pal.activity_type
        WHERE pal.user_id = v_uid
        ORDER BY pal.occurred_at DESC
        LIMIT v_limit
      ) e
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_physical_activity(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_physical_activity(int) TO authenticated;
