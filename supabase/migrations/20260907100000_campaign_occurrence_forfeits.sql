-- Athlete forfeit of campaign makeup debt (explicit Skip).
--
-- Calendar auto-miss still sets campaign_occurrences.status = 'skipped'. That
-- means the live window closed and makeup is allowed. An athlete Skip is a
-- separate personal forfeit: they choose not to make the mission up. Standings
-- still count the occurrence as eligible without a score (hurts attendance).

CREATE TABLE IF NOT EXISTS public.campaign_occurrence_forfeits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id uuid NOT NULL REFERENCES public.campaign_occurrences (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_occurrence_forfeits_occurrence_user_uidx UNIQUE (occurrence_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_occurrence_forfeits_user_id
  ON public.campaign_occurrence_forfeits (user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_occurrence_forfeits_occurrence_id
  ON public.campaign_occurrence_forfeits (occurrence_id);

ALTER TABLE public.campaign_occurrence_forfeits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.campaign_occurrence_forfeits FROM PUBLIC, anon, authenticated;

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
  v_forfeits jsonb;
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
        'mission_id', o.mission_id,
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
        'mission_id', mk.mission_id
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

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'occurrence_id', f.occurrence_id,
        'user_id', f.user_id
      )
      ORDER BY f.created_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_forfeits
  FROM public.campaign_occurrence_forfeits f
  INNER JOIN public.campaign_occurrences o ON o.id = f.occurrence_id
  WHERE o.campaign_id = p_campaign_id;

  RETURN jsonb_build_object(
    'ok', true,
    'campaign', jsonb_build_object(
      'campaign_id', v_campaign.id,
      'name', v_campaign.name,
      'goal', v_campaign.goal,
      'week_count', v_campaign.week_count,
      'missions_per_week', v_campaign.missions_per_week,
      'start_date', v_campaign.start_date,
      'timezone', v_campaign.timezone,
      'status', v_campaign.status,
      'created_at', v_campaign.created_at,
      'viewer_role', v_role,
      'invite_code', CASE WHEN v_role = 'host' THEN v_campaign.invite_code ELSE NULL END
    ),
    'occurrences', v_occurrences,
    'members', v_members,
    'makeups', v_makeups,
    'forfeits', v_forfeits
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.campaign_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.campaign_detail(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.skip_campaign_makeup(p_occurrence_id uuid)
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

  IF EXISTS (
    SELECT 1
    FROM public.campaign_occurrence_forfeits f
    WHERE f.occurrence_id = p_occurrence_id AND f.user_id = v_uid
  ) THEN
    RETURN jsonb_build_object('ok', true, 'already_skipped', true);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.campaign_makeups mk
    WHERE mk.occurrence_id = p_occurrence_id AND mk.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Already making this up';
  END IF;

  v_joined_local := (v_member.joined_at AT TIME ZONE v_campaign.timezone)::date;

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
  ORDER BY o.sequence ASC
  LIMIT 1;

  IF v_head_id IS NULL OR v_head_id <> p_occurrence_id THEN
    RAISE EXCEPTION 'Not next to make up';
  END IF;

  INSERT INTO public.campaign_occurrence_forfeits (occurrence_id, user_id)
  VALUES (p_occurrence_id, v_uid);

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.skip_campaign_makeup(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.skip_campaign_makeup(uuid) TO authenticated;

-- Guard makeup start the same way: forfeited debt cannot be settled.
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
  v_existing public.campaign_makeups%ROWTYPE;
  v_nickname text;
  v_active int;
  v_mission_id uuid;
  v_host_token text;
  v_participant_id uuid;
  v_claim_token text;
  v_claim_hash text;
  v_paced_id uuid;
  v_pacer jsonb;
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

  IF EXISTS (
    SELECT 1
    FROM public.campaign_occurrence_forfeits f
    WHERE f.occurrence_id = p_occurrence_id AND f.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Mission skipped';
  END IF;

  -- Resume an incomplete makeup for this occurrence.
  SELECT * INTO v_existing
  FROM public.campaign_makeups
  WHERE occurrence_id = p_occurrence_id AND user_id = v_uid;

  IF FOUND THEN
    SELECT s.host_token, part.id, part.nickname
    INTO v_host_token, v_participant_id, v_nickname
    FROM public.missions s
    INNER JOIN public.participants part
      ON part.mission_id = s.id
     AND part.user_id = v_uid
     AND part.role = 'host'
    WHERE s.id = v_existing.mission_id;

    v_pacer := NULL;
    IF v_existing.paced_against_participant_id IS NOT NULL AND v_occ.mission_id IS NOT NULL THEN
      SELECT jsonb_build_object(
        'mission_id', s.id,
        'participant_id', p.id,
        'nickname', p.nickname,
        'final_score', psr.final_score,
        'base_score', (
          (
            SELECT count(*)::int
            FROM public.rounds r
            WHERE r.participant_id = p.id
              AND r.segment_index = s.segment_index
          ) * public.compute_reps_per_round(s.workout)
          + psr.partial_reps
        ),
        'created_at', s.created_at
      )
      INTO v_pacer
      FROM public.participants p
      INNER JOIN public.missions s ON s.id = p.mission_id
      INNER JOIN public.participant_segment_results psr
        ON psr.participant_id = p.id
       AND psr.segment_index = s.segment_index
      INNER JOIN public.campaign_members own
        ON own.campaign_id = v_campaign.id
       AND own.user_id = p.user_id
       AND own.status = 'active'
      WHERE p.id = v_existing.paced_against_participant_id
        AND s.id = v_occ.mission_id
        AND psr.final_score IS NOT NULL;
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'mission_id', v_existing.mission_id,
      'host_token', v_host_token,
      'participant_id', v_participant_id,
      'claim_token', NULL,
      'nickname', v_nickname,
      'pacer', v_pacer
    );
  END IF;

  v_joined_local := (v_member.joined_at AT TIME ZONE v_campaign.timezone)::date;

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

  v_paced_id := NULL;
  v_pacer := NULL;
  IF v_occ.mission_id IS NOT NULL THEN
    SELECT p.id
    INTO v_paced_id
    FROM public.participants p
    INNER JOIN public.missions s ON s.id = p.mission_id
    INNER JOIN public.participant_segment_results psr
      ON psr.participant_id = p.id
     AND psr.segment_index = s.segment_index
    INNER JOIN public.campaign_members own
      ON own.campaign_id = v_campaign.id
     AND own.user_id = p.user_id
     AND own.status = 'active'
    WHERE s.id = v_occ.mission_id
      AND p.user_id IS DISTINCT FROM v_uid
      AND psr.final_score IS NOT NULL
    ORDER BY psr.final_score DESC, s.created_at DESC
    LIMIT 1;

    IF v_paced_id IS NOT NULL THEN
      SELECT jsonb_build_object(
        'mission_id', s.id,
        'participant_id', p.id,
        'nickname', p.nickname,
        'final_score', psr.final_score,
        'base_score', (
          (
            SELECT count(*)::int
            FROM public.rounds r
            WHERE r.participant_id = p.id
              AND r.segment_index = s.segment_index
          ) * public.compute_reps_per_round(s.workout)
          + psr.partial_reps
        ),
        'created_at', s.created_at
      )
      INTO v_pacer
      FROM public.participants p
      INNER JOIN public.missions s ON s.id = p.mission_id
      INNER JOIN public.participant_segment_results psr
        ON psr.participant_id = p.id
       AND psr.segment_index = s.segment_index
      INNER JOIN public.campaign_members own
        ON own.campaign_id = v_campaign.id
       AND own.user_id = p.user_id
       AND own.status = 'active'
      WHERE p.id = v_paced_id
        AND s.id = v_occ.mission_id;
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
  RETURNING id INTO v_mission_id;

  INSERT INTO public.participants (mission_id, nickname, role, claim_token_hash, user_id)
  VALUES (v_mission_id, v_nickname, 'host', v_claim_hash, v_uid)
  RETURNING id INTO v_participant_id;

  INSERT INTO public.campaign_makeups (
    occurrence_id,
    user_id,
    mission_id,
    paced_against_participant_id
  )
  VALUES (p_occurrence_id, v_uid, v_mission_id, v_paced_id);

  RETURN jsonb_build_object(
    'ok', true,
    'mission_id', v_mission_id,
    'host_token', v_host_token,
    'participant_id', v_participant_id,
    'claim_token', v_claim_token,
    'nickname', v_nickname,
    'pacer', v_pacer
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.start_campaign_makeup(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_campaign_makeup(uuid) TO authenticated;
