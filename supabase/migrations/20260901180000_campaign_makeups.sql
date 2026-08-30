-- Campaign makeups (Phase 1 · Owe and settle).
--
-- A live campaign session keeps sessions.campaign_occurrence_id and the unique
-- index that guards double-generation. A makeup cannot reuse that column, so
-- it lives in this link table instead: one row per (occurrence, athlete),
-- pointing at a solo session that never sets campaign_occurrence_id.
--
-- paced_against_participant_id is reserved for Phase 2 (race a crewmate
-- recording). Phase 1 ships settlement with no pacer.

CREATE TABLE IF NOT EXISTS public.campaign_makeups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id uuid NOT NULL REFERENCES public.campaign_occurrences (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  paced_against_participant_id uuid NULL REFERENCES public.participants (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_makeups_occurrence_user_uidx UNIQUE (occurrence_id, user_id),
  CONSTRAINT campaign_makeups_session_uidx UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_makeups_user_id
  ON public.campaign_makeups (user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_makeups_occurrence_id
  ON public.campaign_makeups (occurrence_id);

ALTER TABLE public.campaign_makeups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.campaign_makeups FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Host session cap: open makeups must not eat the three-session limit.
-- ---------------------------------------------------------------------------

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

  -- Copilot suggestion ignored: extracting a shared cap helper would be new abstraction; create_session and host_active_session_count already duplicated this predicate before makeups.
  -- Featured, live campaign, and makeup sessions do not count against the cap.
  SELECT count(*)::int
  INTO v_active
  FROM public.sessions s
  JOIN public.participants p
    ON p.session_id = s.id
   AND p.role = 'host'
   AND p.user_id = v_uid
  WHERE s.state IN ('waiting', 'setup', 'work')
    AND s.is_featured = false
    AND s.campaign_occurrence_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.campaign_makeups m WHERE m.session_id = s.id
    );

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
    AND s.campaign_occurrence_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.campaign_makeups m WHERE m.session_id = s.id
    );

  RETURN jsonb_build_object('ok', true, 'count', coalesce(v_active, 0));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.host_active_session_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.host_active_session_count() TO authenticated;

-- ---------------------------------------------------------------------------
-- Standings: live session scores OR makeup scores, with made_up flag.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.campaign_standings(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_campaign public.campaigns%ROWTYPE;
  v_role text;
  v_members jsonb;
  v_occurrences jsonb;
  v_scores jsonb;
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

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', m.user_id,
        'nickname', coalesce(p.nickname, p.username),
        'joined_at', m.joined_at,
        'joined_local_date', (m.joined_at AT TIME ZONE v_campaign.timezone)::date,
        'status', m.status
      )
      ORDER BY m.joined_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_members
  FROM public.campaign_members m
  LEFT JOIN public.athlete_profiles p ON p.user_id = m.user_id
  WHERE m.campaign_id = p_campaign_id;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'occurrence_id', o.id,
        'local_date', o.local_date,
        'status', o.status
      )
      ORDER BY o.sequence ASC
    ),
    '[]'::jsonb
  )
  INTO v_occurrences
  FROM public.campaign_occurrences o
  WHERE o.campaign_id = p_campaign_id;

  -- Prefer a live-session score when both somehow exist (made_up ASC).
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'occurrence_id', scored.occurrence_id,
        'user_id', scored.user_id,
        'final_score', scored.final_score,
        'made_up', scored.made_up
      )
    ),
    '[]'::jsonb
  )
  INTO v_scores
  FROM (
    SELECT DISTINCT ON (occurrence_id, user_id)
      occurrence_id,
      user_id,
      final_score,
      made_up
    FROM (
      SELECT
        o.id AS occurrence_id,
        part.user_id,
        psr.final_score,
        false AS made_up
      FROM public.campaign_occurrences o
      INNER JOIN public.sessions s ON s.id = o.session_id
      INNER JOIN public.participants part
        ON part.session_id = s.id AND part.user_id IS NOT NULL
      INNER JOIN public.participant_segment_results psr
        ON psr.participant_id = part.id
       AND psr.segment_index = s.segment_index
       AND psr.final_score IS NOT NULL
      WHERE o.campaign_id = p_campaign_id
        AND o.status IN ('generated', 'done')

      UNION ALL

      SELECT
        o.id AS occurrence_id,
        m.user_id,
        psr.final_score,
        true AS made_up
      FROM public.campaign_makeups m
      INNER JOIN public.campaign_occurrences o ON o.id = m.occurrence_id
      INNER JOIN public.sessions s ON s.id = m.session_id
      INNER JOIN public.participants part
        ON part.session_id = s.id AND part.user_id = m.user_id
      INNER JOIN public.participant_segment_results psr
        ON psr.participant_id = part.id
       AND psr.segment_index = s.segment_index
       AND psr.final_score IS NOT NULL
      WHERE o.campaign_id = p_campaign_id
        AND o.status IN ('generated', 'done', 'skipped')
    ) combined
    ORDER BY occurrence_id, user_id, made_up ASC
  ) scored;

  RETURN jsonb_build_object(
    'ok', true,
    'timezone', v_campaign.timezone,
    'members', v_members,
    'occurrences', v_occurrences,
    'scores', v_scores
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.campaign_standings(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.campaign_standings(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Detail: include the viewer's makeup rows for the client-side queue.
-- ---------------------------------------------------------------------------

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
  v_makeups jsonb;
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

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'occurrence_id', mk.occurrence_id,
        'session_id', mk.session_id
      )
      ORDER BY mk.created_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_makeups
  FROM public.campaign_makeups mk
  INNER JOIN public.campaign_occurrences o ON o.id = mk.occurrence_id
  WHERE o.campaign_id = p_campaign_id
    AND mk.user_id = v_uid;

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
    'members', v_members,
    'makeups', v_makeups
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.campaign_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.campaign_detail(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Start (or resume) a makeup for the head of the athlete's owed queue.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.start_campaign_makeup(p_occurrence_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_occ public.campaign_occurrences%ROWTYPE;
  v_campaign public.campaigns%ROWTYPE;
  v_member public.campaign_members%ROWTYPE;
  v_joined_local date;
  v_head_id uuid;
  v_existing_session uuid;
  v_nickname text;
  v_active int;
  v_session_id uuid;
  v_host_token text;
  v_participant_id uuid;
  v_claim_token text;
  v_claim_hash text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_occurrence_id IS NULL THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  SELECT * INTO v_occ FROM public.campaign_occurrences WHERE id = p_occurrence_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  SELECT * INTO v_campaign FROM public.campaigns WHERE id = v_occ.campaign_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  IF v_campaign.status <> 'active' THEN
    RAISE EXCEPTION 'Campaign closed';
  END IF;

  SELECT * INTO v_member
  FROM public.campaign_members
  WHERE campaign_id = v_campaign.id AND user_id = v_uid AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  -- Resume an incomplete makeup for this occurrence.
  SELECT session_id INTO v_existing_session
  FROM public.campaign_makeups
  WHERE occurrence_id = p_occurrence_id AND user_id = v_uid;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'session_id', v_existing_session);
  END IF;

  v_joined_local := (v_member.joined_at AT TIME ZONE v_campaign.timezone)::date;

  -- Same rules as campaignMakeupQueue.ts: oldest owed occurrence first.
  SELECT o.id INTO v_head_id
  FROM public.campaign_occurrences o
  WHERE o.campaign_id = v_campaign.id
    AND o.status IN ('done', 'skipped')
    AND o.local_date >= v_joined_local
    AND NOT EXISTS (
      SELECT 1
      FROM public.campaign_makeups mk
      WHERE mk.occurrence_id = o.id AND mk.user_id = v_uid
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.sessions s
      INNER JOIN public.participants part
        ON part.session_id = s.id AND part.user_id = v_uid
      INNER JOIN public.participant_segment_results psr
        ON psr.participant_id = part.id
       AND psr.segment_index = s.segment_index
       AND psr.final_score IS NOT NULL
      WHERE s.id = o.session_id
    )
  ORDER BY o.sequence ASC
  LIMIT 1;

  IF v_head_id IS NULL OR v_head_id <> p_occurrence_id THEN
    RAISE EXCEPTION 'Not next to make up';
  END IF;

  IF NOT public.validate_workout(v_occ.workout) THEN
    RAISE EXCEPTION 'Invalid workout format';
  END IF;

  SELECT coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.username), ''), 'Athlete')
  INTO v_nickname
  FROM public.athlete_profiles p
  WHERE p.user_id = v_uid;

  IF v_nickname IS NULL THEN
    RAISE EXCEPTION 'Intake required';
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
    AND s.campaign_occurrence_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.campaign_makeups m WHERE m.session_id = s.id
    );

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
    time_left_sec
  )
  VALUES (
    v_host_token,
    v_occ.duration_minutes,
    v_occ.workout,
    v_occ.template_id,
    v_occ.intensity_tier,
    'waiting',
    10
  )
  RETURNING id INTO v_session_id;

  INSERT INTO public.participants (session_id, nickname, role, claim_token_hash, user_id)
  VALUES (v_session_id, v_nickname, 'host', v_claim_hash, v_uid)
  RETURNING id INTO v_participant_id;

  INSERT INTO public.campaign_makeups (occurrence_id, user_id, session_id)
  VALUES (p_occurrence_id, v_uid, v_session_id);

  RETURN jsonb_build_object(
    'ok', true,
    'session_id', v_session_id,
    'host_token', v_host_token,
    'participant_id', v_participant_id,
    'claim_token', v_claim_token
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.start_campaign_makeup(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_campaign_makeup(uuid) TO authenticated;
