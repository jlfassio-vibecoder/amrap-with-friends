-- Host Reset: delete the live mission and rematch with the same workout (empty rounds).

CREATE OR REPLACE FUNCTION public.reset_live_mission(
  p_mission_id uuid,
  p_host_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_old public.missions%ROWTYPE;
  v_roster jsonb;
  v_new_mission_id uuid;
  v_host_token text;
  v_host_participant_id uuid;
  v_host_claim_token text;
  v_part jsonb;
  v_claim_token text;
  v_claim_hash text;
  v_role text;
  v_nickname text;
  v_user_id uuid;
  v_rally_point_member_id uuid;
BEGIN
  IF p_mission_id IS NULL OR p_host_token IS NULL OR length(trim(p_host_token)) = 0 THEN
    RAISE EXCEPTION 'Mission not found';
  END IF;

  SELECT *
  INTO v_old
  FROM public.missions
  WHERE id = p_mission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission not found';
  END IF;

  IF v_old.host_token IS DISTINCT FROM p_host_token THEN
    RAISE EXCEPTION 'Invalid host token';
  END IF;

  IF v_old.is_featured THEN
    RAISE EXCEPTION 'Featured missions cannot be reset';
  END IF;

  IF v_old.campaign_occurrence_id IS NOT NULL THEN
    RAISE EXCEPTION 'Campaign missions cannot be reset';
  END IF;

  IF v_old.state NOT IN ('waiting', 'setup', 'work') THEN
    RAISE EXCEPTION 'Mission cannot be reset in this state';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.participants p
    INNER JOIN public.participant_segment_results psr
      ON psr.participant_id = p.id
     AND psr.segment_index = v_old.segment_index
    WHERE p.mission_id = p_mission_id
      AND psr.score_breakdown IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Completed missions cannot be reset';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'nickname', p.nickname,
        'role', p.role,
        'user_id', p.user_id,
        'rally_point_member_id', p.rally_point_member_id,
        'joined_at', p.joined_at
      )
      ORDER BY p.joined_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_roster
  FROM public.participants p
  WHERE p.mission_id = p_mission_id;

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_roster) AS elem
    WHERE elem ->> 'role' = 'host'
  ) THEN
    RAISE EXCEPTION 'Mission not found';
  END IF;

  DELETE FROM public.missions
  WHERE id = p_mission_id;

  v_host_token := gen_random_uuid()::text;

  INSERT INTO public.missions (
    host_token,
    duration_minutes,
    workout,
    template_id,
    intensity_tier,
    state,
    time_left_sec,
    is_paused,
    rally_point_id
  )
  VALUES (
    v_host_token,
    v_old.duration_minutes,
    v_old.workout,
    v_old.template_id,
    v_old.intensity_tier,
    'waiting',
    10,
    false,
    v_old.rally_point_id
  )
  RETURNING id INTO v_new_mission_id;

  IF v_old.rally_point_id IS NOT NULL THEN
    UPDATE public.rally_points
    SET active_mission_id = v_new_mission_id,
        next_mission_pending_at = NULL
    WHERE id = v_old.rally_point_id;
  END IF;

  v_host_participant_id := NULL;
  v_host_claim_token := NULL;

  FOR v_part IN
    SELECT value
    FROM jsonb_array_elements(v_roster) AS t(value)
  LOOP
    v_nickname := trim(v_part ->> 'nickname');
    IF v_nickname IS NULL OR v_nickname = '' THEN
      CONTINUE;
    END IF;

    v_role := v_part ->> 'role';
    IF v_role IS DISTINCT FROM 'host' AND v_role IS DISTINCT FROM 'joiner' THEN
      v_role := 'joiner';
    END IF;

    v_user_id := NULL;
    IF v_part ? 'user_id' AND jsonb_typeof(v_part -> 'user_id') <> 'null' THEN
      v_user_id := (v_part ->> 'user_id')::uuid;
    END IF;

    v_rally_point_member_id := NULL;
    IF v_part ? 'rally_point_member_id'
       AND jsonb_typeof(v_part -> 'rally_point_member_id') <> 'null' THEN
      v_rally_point_member_id := (v_part ->> 'rally_point_member_id')::uuid;
    END IF;

    v_claim_token :=
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

    INSERT INTO public.participants (
      mission_id,
      nickname,
      role,
      claim_token_hash,
      user_id,
      rally_point_member_id
    )
    VALUES (
      v_new_mission_id,
      v_nickname,
      v_role,
      v_claim_hash,
      v_user_id,
      v_rally_point_member_id
    );

    IF v_role = 'host' AND v_host_participant_id IS NULL THEN
      SELECT id INTO v_host_participant_id
      FROM public.participants
      WHERE mission_id = v_new_mission_id
        AND role = 'host'
      ORDER BY joined_at ASC
      LIMIT 1;
      v_host_claim_token := v_claim_token;
    END IF;
  END LOOP;

  IF v_host_participant_id IS NULL OR v_host_claim_token IS NULL THEN
    RAISE EXCEPTION 'Mission not found';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'mission_id', v_new_mission_id,
    'host_token', v_host_token,
    'participant_id', v_host_participant_id,
    'claim_token', v_host_claim_token,
    'rally_point_id', v_old.rally_point_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_live_mission(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_live_mission(uuid, text) TO anon, authenticated;
