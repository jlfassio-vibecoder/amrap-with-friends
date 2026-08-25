-- Optional today/tomorrow rally time + 3-session host cap

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz NULL;

GRANT SELECT (scheduled_at) ON public.sessions TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_session(
  p_duration_minutes int,
  p_nickname text,
  p_workout jsonb,
  p_template_id text,
  p_intensity_tier int,
  p_scheduled_at timestamptz,
  p_timezone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_session_id uuid;
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
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.athlete_profiles WHERE user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Intake required';
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

  SELECT count(*)::int
  INTO v_active
  FROM public.sessions s
  JOIN public.participants p
    ON p.session_id = s.id
   AND p.role = 'host'
   AND p.user_id = v_uid
  WHERE s.state IN ('waiting', 'setup', 'work');

  IF v_active >= 3 THEN
    RAISE EXCEPTION 'Host session limit reached';
  END IF;

  v_host_token := gen_random_uuid()::text;
  v_claim_token :=
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

  INSERT INTO public.sessions (
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
  RETURNING id INTO v_session_id;

  INSERT INTO public.participants (session_id, nickname, role, claim_token_hash, user_id)
  VALUES (v_session_id, v_nickname, 'host', v_claim_hash, v_uid)
  RETURNING id INTO v_participant_id;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'host_token', v_host_token,
    'participant_id', v_participant_id,
    'claim_token', v_claim_token
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_session(int, text, jsonb, text, int, timestamptz, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_session(int, text, jsonb, text, int, timestamptz, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.create_session(
  p_duration_minutes int,
  p_nickname text,
  p_workout jsonb,
  p_template_id text DEFAULT NULL,
  p_intensity_tier int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  RETURN public.create_session(
    p_duration_minutes,
    p_nickname,
    p_workout,
    p_template_id,
    p_intensity_tier,
    NULL,
    NULL
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_session(int, text, jsonb, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_session(int, text, jsonb, text, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_session(
  p_duration_minutes int,
  p_nickname text,
  p_workout jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  RETURN public.create_session(p_duration_minutes, p_nickname, p_workout, NULL, NULL);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_session(int, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_session(int, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.host_active_session_count()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_active int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT count(*)::int
  INTO v_active
  FROM public.sessions s
  JOIN public.participants p
    ON p.session_id = s.id
   AND p.role = 'host'
   AND p.user_id = v_uid
  WHERE s.state IN ('waiting', 'setup', 'work');

  RETURN jsonb_build_object('ok', true, 'count', coalesce(v_active, 0));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.host_active_session_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.host_active_session_count() TO authenticated;
