-- Claim scored solo missions as campaign makeups when the athlete still owes
-- that workout. Campaign debt settles by FK (live mission_id or campaign_makeups),
-- so a library create with the same template used to leave an orphan score while
-- the schedule stayed Missed. On lock (and once for history), attach the score.

CREATE OR REPLACE FUNCTION public.claim_scored_mission_as_campaign_makeup(p_mission_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_mission public.missions%ROWTYPE;
  v_uid uuid;
  v_occurrence_id uuid;
  v_existing_makeup_mission uuid;
BEGIN
  IF p_mission_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Live campaign missions and featured WODs are already accounted for.
  IF v_mission.campaign_occurrence_id IS NOT NULL OR v_mission.is_featured THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.campaign_makeups mk WHERE mk.mission_id = p_mission_id
  ) THEN
    RETURN NULL;
  END IF;

  IF v_mission.template_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT part.user_id
  INTO v_uid
  FROM public.participants part
  WHERE part.mission_id = p_mission_id
    AND part.role = 'host'
    AND part.user_id IS NOT NULL
  LIMIT 1;

  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  -- Must have a usable locked score for this athlete on the mission.
  IF NOT EXISTS (
    SELECT 1
    FROM public.participants part
    INNER JOIN public.participant_segment_results psr
      ON psr.participant_id = part.id
     AND psr.segment_index = v_mission.segment_index
     AND psr.final_score IS NOT NULL
    WHERE part.mission_id = p_mission_id
      AND part.user_id = v_uid
  ) THEN
    RETURN NULL;
  END IF;

  -- Oldest owed occurrence across active campaigns that matches this workout.
  SELECT o.id
  INTO v_occurrence_id
  FROM public.campaign_occurrences o
  INNER JOIN public.campaigns c ON c.id = o.campaign_id
  INNER JOIN public.campaign_members m
    ON m.campaign_id = c.id
   AND m.user_id = v_uid
   AND m.status = 'active'
  WHERE c.status = 'active'
    AND o.status IN ('done', 'skipped')
    AND o.local_date >= (m.joined_at AT TIME ZONE c.timezone)::date
    AND o.template_id IS NOT DISTINCT FROM v_mission.template_id
    AND o.duration_minutes = v_mission.duration_minutes
    AND NOT EXISTS (
      SELECT 1
      FROM public.campaign_occurrence_forfeits f
      WHERE f.occurrence_id = o.id AND f.user_id = v_uid
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.missions s
      INNER JOIN public.participants part
        ON part.mission_id = s.id AND part.user_id = v_uid
      INNER JOIN public.participant_segment_results psr
        ON psr.participant_id = part.id
       AND psr.segment_index = s.segment_index
       AND psr.final_score IS NOT NULL
      WHERE s.id = o.mission_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.campaign_makeups mk
      INNER JOIN public.missions s ON s.id = mk.mission_id
      INNER JOIN public.participants part
        ON part.mission_id = s.id AND part.user_id = v_uid
      INNER JOIN public.participant_segment_results psr
        ON psr.participant_id = part.id
       AND psr.segment_index = s.segment_index
       AND psr.final_score IS NOT NULL
      WHERE mk.occurrence_id = o.id AND mk.user_id = v_uid
    )
  ORDER BY o.local_date ASC, o.sequence ASC
  LIMIT 1;

  IF v_occurrence_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Drop an incomplete (unscored) makeup so the scored mission can take its place.
  SELECT mk.mission_id
  INTO v_existing_makeup_mission
  FROM public.campaign_makeups mk
  WHERE mk.occurrence_id = v_occurrence_id AND mk.user_id = v_uid;

  IF v_existing_makeup_mission IS NOT NULL THEN
    DELETE FROM public.campaign_makeups
    WHERE occurrence_id = v_occurrence_id AND user_id = v_uid;

    DELETE FROM public.missions
    WHERE id = v_existing_makeup_mission
      AND campaign_occurrence_id IS NULL
      AND state IN ('waiting', 'setup', 'work')
      AND NOT EXISTS (
        SELECT 1
        FROM public.participants part
        INNER JOIN public.participant_segment_results psr
          ON psr.participant_id = part.id
         AND psr.final_score IS NOT NULL
        WHERE part.mission_id = v_existing_makeup_mission
      );
  END IF;

  INSERT INTO public.campaign_makeups (occurrence_id, user_id, mission_id)
  VALUES (v_occurrence_id, v_uid, p_mission_id)
  ON CONFLICT (occurrence_id, user_id) DO NOTHING;

  RETURN v_occurrence_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_scored_mission_as_campaign_makeup(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_claim_scored_mission_as_campaign_makeup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_mission_id uuid;
BEGIN
  IF NEW.final_score IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.final_score IS NOT NULL
     AND OLD.final_score IS NOT DISTINCT FROM NEW.final_score THEN
    RETURN NEW;
  END IF;

  SELECT part.mission_id
  INTO v_mission_id
  FROM public.participants part
  WHERE part.id = NEW.participant_id;

  IF v_mission_id IS NOT NULL THEN
    PERFORM public.claim_scored_mission_as_campaign_makeup(v_mission_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS claim_scored_mission_as_campaign_makeup
  ON public.participant_segment_results;

CREATE TRIGGER claim_scored_mission_as_campaign_makeup
  AFTER INSERT OR UPDATE OF final_score, score_breakdown
  ON public.participant_segment_results
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_claim_scored_mission_as_campaign_makeup();

-- One-shot: attach any already-scored orphans that still match owed debt.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT s.id AS mission_id
    FROM public.missions s
    INNER JOIN public.participants part
      ON part.mission_id = s.id
     AND part.role = 'host'
     AND part.user_id IS NOT NULL
    INNER JOIN public.participant_segment_results psr
      ON psr.participant_id = part.id
     AND psr.segment_index = s.segment_index
     AND psr.final_score IS NOT NULL
    WHERE s.campaign_occurrence_id IS NULL
      AND s.is_featured = false
      AND s.template_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.campaign_makeups mk WHERE mk.mission_id = s.id
      )
  LOOP
    PERFORM public.claim_scored_mission_as_campaign_makeup(r.mission_id);
  END LOOP;
END;
$$;

-- Refuse creating a standalone mission for a workout the athlete still owes
-- on an active campaign — settle it from the campaign schedule instead.
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

  IF v_uid IS NOT NULL AND v_template_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.campaign_occurrences o
      INNER JOIN public.campaigns c ON c.id = o.campaign_id
      INNER JOIN public.campaign_members m
        ON m.campaign_id = c.id
       AND m.user_id = v_uid
       AND m.status = 'active'
      WHERE c.status = 'active'
        AND o.status IN ('done', 'skipped')
        AND o.local_date >= (m.joined_at AT TIME ZONE c.timezone)::date
        AND o.template_id IS NOT DISTINCT FROM v_template_id
        AND o.duration_minutes = p_duration_minutes
        AND NOT EXISTS (
          SELECT 1
          FROM public.campaign_occurrence_forfeits f
          WHERE f.occurrence_id = o.id AND f.user_id = v_uid
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.missions s
          INNER JOIN public.participants part
            ON part.mission_id = s.id AND part.user_id = v_uid
          INNER JOIN public.participant_segment_results psr
            ON psr.participant_id = part.id
           AND psr.segment_index = s.segment_index
           AND psr.final_score IS NOT NULL
          WHERE s.id = o.mission_id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.campaign_makeups mk
          INNER JOIN public.missions s ON s.id = mk.mission_id
          INNER JOIN public.participants part
            ON part.mission_id = s.id AND part.user_id = v_uid
          INNER JOIN public.participant_segment_results psr
            ON psr.participant_id = part.id
           AND psr.segment_index = s.segment_index
           AND psr.final_score IS NOT NULL
          WHERE mk.occurrence_id = o.id AND mk.user_id = v_uid
        )
    ) THEN
      RAISE EXCEPTION 'Make this up from your campaign';
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
