-- Allow anonymous athletes to create an unscheduled mission (Open rally point now).
-- Scheduled create and create_rally_point_mission stay authenticated-only.
-- Guest host row: user_id NULL + claim_token_hash (same as join_mission guests).

CREATE OR REPLACE FUNCTION public.create_mission(
  p_duration_minutes integer,
  p_nickname text,
  p_workout jsonb,
  p_template_id text,
  p_intensity_tier integer,
  p_scheduled_at timestamp with time zone,
  p_timezone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_mission_id uuid;
  v_host_token text;
  v_participant_id uuid;
  v_nickname text;
  v_claim_token text;
  v_claim_hash text;
  v_template_id text;
  v_intensity_tier int;
  v_timezone text;
  v_today date;
  v_rally_date date;
  v_active int;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL AND p_scheduled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Sign in to schedule a mission.';
  END IF;

  IF v_uid IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.athlete_profiles WHERE user_id = v_uid
    ) THEN
      RAISE EXCEPTION 'Intake required';
    END IF;
  END IF;

  v_nickname := trim(p_nickname);
  IF v_nickname IS NULL OR v_nickname = '' OR length(v_nickname) > 50 THEN
    RAISE EXCEPTION 'Name or nickname is required (max 50 characters)';
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes < 1 OR p_duration_minutes > 60 THEN
    RAISE EXCEPTION 'Duration must be between 1 and 60 minutes';
  END IF;

  IF NOT public.validate_workout(p_workout) THEN
    RAISE EXCEPTION 'Invalid workout format';
  END IF;

  v_template_id := NULL;
  IF p_template_id IS NOT NULL THEN
    v_template_id := trim(p_template_id);
    IF v_template_id = '' OR length(v_template_id) > 120 THEN
      RAISE EXCEPTION 'Invalid template id';
    END IF;
  END IF;

  v_intensity_tier := NULL;
  IF p_intensity_tier IS NOT NULL THEN
    IF p_intensity_tier < 1 OR p_intensity_tier > 5 THEN
      RAISE EXCEPTION 'Intensity tier must be between 1 and 5';
    END IF;
    v_intensity_tier := p_intensity_tier;
  END IF;

  IF p_scheduled_at IS NOT NULL THEN
    v_timezone := btrim(p_timezone);
    IF v_timezone IS NULL
       OR v_timezone = ''
       OR NOT EXISTS (
         SELECT 1
         FROM pg_timezone_names
         WHERE name = v_timezone
       )
    THEN
      RAISE EXCEPTION 'invalid_timezone';
    END IF;

    IF p_scheduled_at <= now() THEN
      RAISE EXCEPTION 'Rally time must be in the future';
    END IF;

    v_today := (now() AT TIME ZONE v_timezone)::date;
    v_rally_date := (p_scheduled_at AT TIME ZONE v_timezone)::date;

    IF v_rally_date < v_today OR v_rally_date > (v_today + 1) THEN
      RAISE EXCEPTION 'Rally time must be today or tomorrow';
    END IF;
  END IF;

  IF v_uid IS NOT NULL THEN
    -- Featured, live campaign, and makeup missions do not count against the cap.
    SELECT count(*)::int
    INTO v_active
    FROM public.missions s
    JOIN public.participants p
      ON p.mission_id = s.id
     AND p.role = 'host'
     AND p.user_id = v_uid
    WHERE s.state IN ('waiting', 'setup', 'work')
      AND s.is_featured = false
      AND s.campaign_occurrence_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.campaign_makeups m WHERE m.mission_id = s.id
      );

    IF v_active >= 3 THEN
      RAISE EXCEPTION 'Host mission limit reached';
    END IF;
  END IF;

  v_host_token := gen_random_uuid()::text;
  v_claim_token :=
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

  INSERT INTO public.missions (
    host_token,
    duration_minutes,
    workout,
    template_id,
    intensity_tier,
    state,
    time_left_sec,
    scheduled_at
  )
  VALUES (
    v_host_token,
    p_duration_minutes,
    p_workout,
    v_template_id,
    v_intensity_tier,
    'waiting',
    10,
    p_scheduled_at
  )
  RETURNING id INTO v_mission_id;

  INSERT INTO public.participants (mission_id, nickname, role, claim_token_hash, user_id)
  VALUES (v_mission_id, v_nickname, 'host', v_claim_hash, v_uid)
  RETURNING id INTO v_participant_id;

  RETURN jsonb_build_object(
    'mission_id', v_mission_id,
    'host_token', v_host_token,
    'participant_id', v_participant_id,
    'claim_token', v_claim_token
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_mission(integer, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_mission(integer, text, jsonb, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_mission(
  integer,
  text,
  jsonb,
  text,
  integer,
  timestamp with time zone,
  text
) TO anon, authenticated;
