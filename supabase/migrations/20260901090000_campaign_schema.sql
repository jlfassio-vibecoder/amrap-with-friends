-- Campaigns phase 1: schema plus create/read RPCs.
--
-- A campaign is a 2/4/6/8/12-week programme of 1-5 sessions a week that a
-- host runs with a crew. Design choices locked in with the user:
--
--   - Occurrences are materialised up front; sessions are NOT. The host has
--     to see and edit the calendar, and a pure recurrence rule cannot express
--     "move week 3's second session". Sessions stay virtual until the
--     generator creates each lobby shortly before it is due, the same way
--     run_featured_wod_scheduler() works. That keeps the host session cap
--     honest and leaves an abandoned campaign as rows of plan rather than
--     sixty dead lobbies.
--   - Occurrences store a local date and a wall-clock time, never an instant.
--     A campaign booked for 18:00 must still be 18:00 after the clocks
--     change, so the absolute time is resolved at generation.
--   - The workout template library lives in the client, not the database, so
--     each occurrence carries its own resolved workout jsonb (validated by
--     validate_workout, exactly as create_session does). The generator copies
--     it into the session rather than looking anything up.
--   - Campaign membership requires an account: twelve weeks of attendance and
--     standings need a stable identity, and a nickname is not one. Joining an
--     individual session stays guest-friendly and is untouched.
--
-- Later phases add join_campaign, run_campaign_scheduler() and standings.

CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  goal text,
  week_count int NOT NULL,
  sessions_per_week int NOT NULL,
  start_date date NOT NULL,
  timezone text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  invite_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaigns_name_length CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  CONSTRAINT campaigns_goal_length CHECK (goal IS NULL OR length(goal) <= 280),
  CONSTRAINT campaigns_week_count_allowed CHECK (week_count IN (2, 4, 6, 8, 12)),
  CONSTRAINT campaigns_sessions_per_week_range CHECK (sessions_per_week BETWEEN 1 AND 5),
  CONSTRAINT campaigns_status_allowed CHECK (
    status IN ('draft', 'active', 'complete', 'abandoned')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS campaigns_invite_code_uidx
  ON public.campaigns (invite_code);
CREATE INDEX IF NOT EXISTS idx_campaigns_host_user_id
  ON public.campaigns (host_user_id);

CREATE TABLE IF NOT EXISTS public.campaign_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  sequence int NOT NULL,
  week_number int NOT NULL,
  slot_number int NOT NULL,
  -- Wall clock in the campaign's timezone. Deliberately not a timestamptz:
  -- see the DST note above.
  local_date date NOT NULL,
  local_time time NOT NULL,
  template_id text,
  duration_minutes int NOT NULL,
  intensity_tier int,
  workout jsonb NOT NULL,
  session_id uuid REFERENCES public.sessions (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_occurrences_sequence_positive CHECK (sequence >= 1),
  CONSTRAINT campaign_occurrences_week_positive CHECK (week_number >= 1),
  CONSTRAINT campaign_occurrences_slot_range CHECK (slot_number BETWEEN 1 AND 5),
  CONSTRAINT campaign_occurrences_duration_range CHECK (duration_minutes BETWEEN 1 AND 60),
  CONSTRAINT campaign_occurrences_intensity_range CHECK (
    intensity_tier IS NULL OR intensity_tier BETWEEN 1 AND 5
  ),
  CONSTRAINT campaign_occurrences_status_allowed CHECK (
    status IN ('planned', 'generated', 'done', 'skipped')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS campaign_occurrences_campaign_sequence_uidx
  ON public.campaign_occurrences (campaign_id, sequence);
CREATE INDEX IF NOT EXISTS idx_campaign_occurrences_due
  ON public.campaign_occurrences (local_date, local_time)
  WHERE status = 'planned';

CREATE TABLE IF NOT EXISTS public.campaign_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_members_role_allowed CHECK (role IN ('host', 'member')),
  CONSTRAINT campaign_members_status_allowed CHECK (status IN ('active', 'left'))
);

CREATE UNIQUE INDEX IF NOT EXISTS campaign_members_campaign_user_uidx
  ON public.campaign_members (campaign_id, user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_members_user_id
  ON public.campaign_members (user_id);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.campaigns FROM PUBLIC, anon, authenticated;
ALTER TABLE public.campaign_occurrences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.campaign_occurrences FROM PUBLIC, anon, authenticated;
ALTER TABLE public.campaign_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.campaign_members FROM PUBLIC, anon, authenticated;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS campaign_occurrence_id uuid NULL
    REFERENCES public.campaign_occurrences (id) ON DELETE SET NULL;

-- Guards the generator against double-creating a session for one occurrence
-- under concurrent cron ticks, mirroring sessions_featured_schedule_time_uidx.
CREATE UNIQUE INDEX IF NOT EXISTS sessions_campaign_occurrence_uidx
  ON public.sessions (campaign_occurrence_id)
  WHERE campaign_occurrence_id IS NOT NULL;

GRANT SELECT (campaign_occurrence_id) ON public.sessions TO anon, authenticated;

-- Blocker fix, shipped with the tables it affects: the host active-session
-- cap counted every session where the user is the host participant, which
-- includes machine-generated Featured sessions and (from this migration)
-- campaign sessions. A 12x5 campaign would have locked the host out of
-- creating anything else, and a coach running Featured WODs can already hit
-- this today.

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

  -- Only sessions the host actually opened themselves count against the cap.
  -- Featured and campaign sessions are machine-generated and list this user
  -- as host, so counting them would silently lock a coach (or anyone running
  -- a campaign) out of creating their own session.
  SELECT count(*)::int
  INTO v_active
  FROM public.sessions s
  JOIN public.participants p
    ON p.session_id = s.id
   AND p.role = 'host'
   AND p.user_id = v_uid
  WHERE s.state IN ('waiting', 'setup', 'work')
    AND s.is_featured = false
    AND s.campaign_occurrence_id IS NULL;

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

-- host_active_session_count() feeds the create screen's remaining-slots hint,
-- so it has to agree with the cap above or the UI lies.
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
  WHERE s.state IN ('waiting', 'setup', 'work')
    AND s.is_featured = false
    AND s.campaign_occurrence_id IS NULL;

  RETURN jsonb_build_object('ok', true, 'count', coalesce(v_active, 0));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.host_active_session_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.host_active_session_count() TO authenticated;

-- Cap on concurrently active campaigns per host, mirroring the 3-session cap.
-- Without it one account can plant an unbounded number of 60-row calendars.
CREATE OR REPLACE FUNCTION public.create_campaign(
  p_name text,
  p_goal text,
  p_week_count int,
  p_start_date date,
  p_timezone text,
  p_occurrences jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_name text;
  v_goal text;
  v_tz text;
  v_active int;
  v_len int;
  v_elem jsonb;
  v_sessions_per_week int;
  v_expected int;
  v_campaign_id uuid;
  v_invite_code text;
  v_attempt int := 0;
  i int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.athlete_profiles WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Intake required';
  END IF;

  v_name := btrim(p_name);
  IF v_name IS NULL OR v_name = '' OR length(v_name) > 80 THEN
    RAISE EXCEPTION 'Campaign name is required (max 80 characters)';
  END IF;

  v_goal := nullif(btrim(coalesce(p_goal, '')), '');
  IF v_goal IS NOT NULL AND length(v_goal) > 280 THEN
    RAISE EXCEPTION 'Campaign goal must be 280 characters or fewer';
  END IF;

  IF p_week_count IS NULL OR p_week_count NOT IN (2, 4, 6, 8, 12) THEN
    RAISE EXCEPTION 'Campaign length must be 2, 4, 6, 8, or 12 weeks';
  END IF;

  IF p_start_date IS NULL THEN
    RAISE EXCEPTION 'Campaign start date is required';
  END IF;

  v_tz := btrim(p_timezone);
  IF v_tz IS NULL
     OR v_tz = ''
     OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_tz)
  THEN
    RAISE EXCEPTION 'invalid_timezone';
  END IF;

  IF p_occurrences IS NULL OR jsonb_typeof(p_occurrences) <> 'array' THEN
    RAISE EXCEPTION 'Campaign schedule is required';
  END IF;

  v_len := jsonb_array_length(p_occurrences);
  IF v_len < 1 OR v_len > 60 THEN
    RAISE EXCEPTION 'A campaign must have between 1 and 60 sessions';
  END IF;

  -- The client builds the calendar (buildCampaignCalendar), so the shape is
  -- re-derived and re-checked here rather than trusted.
  IF v_len % p_week_count <> 0 THEN
    RAISE EXCEPTION 'Schedule does not divide evenly into the campaign length';
  END IF;

  v_sessions_per_week := v_len / p_week_count;
  IF v_sessions_per_week < 1 OR v_sessions_per_week > 5 THEN
    RAISE EXCEPTION 'A campaign needs 1 to 5 sessions a week';
  END IF;

  v_expected := p_week_count * v_sessions_per_week;
  IF v_len <> v_expected THEN
    RAISE EXCEPTION 'Schedule does not match the campaign length';
  END IF;

  SELECT count(*)::int
  INTO v_active
  FROM public.campaigns
  WHERE host_user_id = v_uid
    AND status IN ('draft', 'active');

  IF v_active >= 3 THEN
    RAISE EXCEPTION 'Campaign limit reached';
  END IF;

  FOR i IN 0..(v_len - 1) LOOP
    v_elem := p_occurrences -> i;

    IF jsonb_typeof(v_elem) <> 'object' THEN
      RAISE EXCEPTION 'Invalid session in the campaign schedule';
    END IF;

    IF (v_elem ->> 'sequence')::int IS DISTINCT FROM (i + 1) THEN
      RAISE EXCEPTION 'Campaign sessions must be numbered 1 to %', v_len;
    END IF;

    IF NOT public.validate_workout(v_elem -> 'workout') THEN
      RAISE EXCEPTION 'Invalid workout format in session %', i + 1;
    END IF;

    IF (v_elem ->> 'duration_minutes')::int IS NULL
       OR (v_elem ->> 'duration_minutes')::int < 1
       OR (v_elem ->> 'duration_minutes')::int > 60
    THEN
      RAISE EXCEPTION 'Session % duration must be between 1 and 60 minutes', i + 1;
    END IF;
  END LOOP;

  -- Retry on the astronomically unlikely invite-code collision rather than
  -- failing the whole create.
  LOOP
    v_attempt := v_attempt + 1;
    v_invite_code := upper(substring(replace(gen_random_uuid()::text, '-', '') FROM 1 FOR 10));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.campaigns WHERE invite_code = v_invite_code
    );
    IF v_attempt >= 5 THEN
      RAISE EXCEPTION 'Could not allocate an invite code, please try again';
    END IF;
  END LOOP;

  INSERT INTO public.campaigns (
    host_user_id, name, goal, week_count, sessions_per_week,
    start_date, timezone, status, invite_code
  )
  VALUES (
    v_uid, v_name, v_goal, p_week_count, v_sessions_per_week,
    p_start_date, v_tz, 'active', v_invite_code
  )
  RETURNING id INTO v_campaign_id;

  INSERT INTO public.campaign_occurrences (
    campaign_id, sequence, week_number, slot_number,
    local_date, local_time, template_id, duration_minutes,
    intensity_tier, workout
  )
  SELECT
    v_campaign_id,
    (elem ->> 'sequence')::int,
    (elem ->> 'week_number')::int,
    (elem ->> 'slot_number')::int,
    (elem ->> 'local_date')::date,
    (elem ->> 'local_time')::time,
    nullif(btrim(coalesce(elem ->> 'template_id', '')), ''),
    (elem ->> 'duration_minutes')::int,
    nullif(elem ->> 'intensity_tier', '')::int,
    elem -> 'workout'
  FROM jsonb_array_elements(p_occurrences) AS elem;

  INSERT INTO public.campaign_members (campaign_id, user_id, role)
  VALUES (v_campaign_id, v_uid, 'host');

  RETURN jsonb_build_object(
    'ok', true,
    'campaign_id', v_campaign_id,
    'invite_code', v_invite_code,
    'sessions_per_week', v_sessions_per_week,
    'total_sessions', v_len
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_campaign(text, text, int, date, text, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_campaign(text, text, int, date, text, jsonb)
  TO authenticated;

-- Campaigns the caller belongs to, host or member. Occurrence counts come
-- back with the row so the list can show progress without a second call.
CREATE OR REPLACE FUNCTION public.my_campaigns()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_campaigns jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT coalesce(
    jsonb_agg(row_to_json(entry)::jsonb ORDER BY entry.start_date DESC),
    '[]'::jsonb
  )
  INTO v_campaigns
  FROM (
    SELECT
      c.id AS campaign_id,
      c.name,
      c.goal,
      c.week_count,
      c.sessions_per_week,
      c.start_date,
      c.timezone,
      c.status,
      c.created_at,
      m.role,
      CASE WHEN c.host_user_id = v_uid THEN c.invite_code ELSE NULL END AS invite_code,
      (
        SELECT count(*)::int FROM public.campaign_occurrences o
        WHERE o.campaign_id = c.id
      ) AS total_sessions,
      (
        SELECT count(*)::int FROM public.campaign_occurrences o
        WHERE o.campaign_id = c.id AND o.status = 'done'
      ) AS completed_sessions,
      (
        SELECT count(*)::int FROM public.campaign_members cm
        WHERE cm.campaign_id = c.id AND cm.status = 'active'
      ) AS member_count
    FROM public.campaigns c
    INNER JOIN public.campaign_members m
      ON m.campaign_id = c.id
     AND m.user_id = v_uid
     AND m.status = 'active'
  ) AS entry;

  RETURN jsonb_build_object('ok', true, 'campaigns', v_campaigns);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.my_campaigns() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_campaigns() TO authenticated;

-- One campaign with its full calendar and roster. Members only; the invite
-- code is host-only so a member cannot re-share the campaign.
CREATE OR REPLACE FUNCTION public.campaign_detail(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_campaign public.campaigns%ROWTYPE;
  v_role text;
  v_occurrences jsonb;
  v_members jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_campaign_id IS NULL THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  SELECT * INTO v_campaign FROM public.campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  SELECT role INTO v_role
  FROM public.campaign_members
  WHERE campaign_id = p_campaign_id AND user_id = v_uid AND status = 'active';

  -- Same error as a missing campaign: a non-member should not be able to
  -- probe which campaign ids exist.
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'occurrence_id', o.id,
        'sequence', o.sequence,
        'week_number', o.week_number,
        'slot_number', o.slot_number,
        'local_date', o.local_date,
        'local_time', to_char(o.local_time, 'HH24:MI'),
        'template_id', o.template_id,
        'duration_minutes', o.duration_minutes,
        'intensity_tier', o.intensity_tier,
        'workout', o.workout,
        'session_id', o.session_id,
        'status', o.status
      )
      ORDER BY o.sequence ASC
    ),
    '[]'::jsonb
  )
  INTO v_occurrences
  FROM public.campaign_occurrences o
  WHERE o.campaign_id = p_campaign_id;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', m.user_id,
        'role', m.role,
        'status', m.status,
        'joined_at', m.joined_at,
        'nickname', coalesce(p.nickname, p.username)
      )
      ORDER BY m.joined_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_members
  FROM public.campaign_members m
  LEFT JOIN public.athlete_profiles p ON p.user_id = m.user_id
  WHERE m.campaign_id = p_campaign_id AND m.status = 'active';

  RETURN jsonb_build_object(
    'ok', true,
    'campaign', jsonb_build_object(
      'campaign_id', v_campaign.id,
      'name', v_campaign.name,
      'goal', v_campaign.goal,
      'week_count', v_campaign.week_count,
      'sessions_per_week', v_campaign.sessions_per_week,
      'start_date', v_campaign.start_date,
      'timezone', v_campaign.timezone,
      'status', v_campaign.status,
      'created_at', v_campaign.created_at,
      'viewer_role', v_role,
      'invite_code', CASE WHEN v_role = 'host' THEN v_campaign.invite_code ELSE NULL END
    ),
    'occurrences', v_occurrences,
    'members', v_members
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.campaign_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.campaign_detail(uuid) TO authenticated;
