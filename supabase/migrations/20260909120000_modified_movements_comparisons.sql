-- Phase 2 of modified movements: protect the comparisons.
--
-- Three read paths learn about the mark. None of them changes a score.
--
-- 1. available_ghosts stops returning a modified run as the personal best to
--    race. A scaled score handed back as a target is one the athlete cannot
--    reach on the programmed movement, which is the opposite of the progression
--    the mark exists to support. The run stays in their own history; it is only
--    the ghost that changes.
--
--    The campaign pacer further down that same function is deliberately NOT
--    filtered, and that is a settled decision rather than an oversight. It races
--    live teammates on the current occurrence rather than a stored best, so
--    filtering it would remove a person from a shared workout instead of
--    declining to hand back a stale target. A teammate who scaled a movement is
--    still someone to train alongside. Do not "fix" this.
--
-- 2. campaign_standings reports whether each score was modified, so a retest can
--    say when it does not match its benchmark. Moving from knee push-ups to full
--    ones is genuine progress that a rep delta alone understates or inverts.
--
-- 3. my_missions carries it so the Modified badge reaches the row.


-- 1. Personal-best ghost: standard runs only.

CREATE OR REPLACE FUNCTION public.available_ghosts(p_template_id text, p_duration_minutes integer, p_for_mission_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_template_id text;
  v_personal_best jsonb;
  v_friends jsonb := '[]'::jsonb;
  v_live_mission_id uuid;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_template_id := trim(p_template_id);
  IF v_template_id IS NULL OR v_template_id = '' OR length(v_template_id) > 120 THEN
    RAISE EXCEPTION 'Invalid template id';
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes < 1 OR p_duration_minutes > 60 THEN
    RAISE EXCEPTION 'Duration must be between 1 and 60 minutes';
  END IF;

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
  INTO v_personal_best
  FROM public.participants p
  INNER JOIN public.missions s ON s.id = p.mission_id
  INNER JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
    AND psr.segment_index = s.segment_index
  WHERE p.user_id = v_uid
    AND s.template_id = v_template_id
    AND s.duration_minutes = p_duration_minutes
    -- Standard runs only: a modified run is history, not a target.
    AND coalesce(cardinality(psr.modified_movements), 0) = 0
    AND psr.final_score IS NOT NULL
    AND psr.score_breakdown IS NOT NULL
  ORDER BY psr.final_score DESC, s.created_at DESC
  LIMIT 1;

  IF p_for_mission_id IS NOT NULL THEN
    SELECT o.mission_id
    INTO v_live_mission_id
    FROM public.campaign_makeups mk
    INNER JOIN public.campaign_occurrences o ON o.id = mk.occurrence_id
    INNER JOIN public.campaign_members req
      ON req.campaign_id = o.campaign_id
     AND req.user_id = v_uid
     AND req.status = 'active'
    WHERE mk.mission_id = p_for_mission_id
      AND mk.user_id = v_uid;

    IF v_live_mission_id IS NOT NULL THEN
      SELECT coalesce(
        jsonb_agg(run.ref ORDER BY run.final_score DESC, run.created_at DESC),
        '[]'::jsonb
      )
      INTO v_friends
      FROM (
        SELECT
          jsonb_build_object(
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
          ) AS ref,
          psr.final_score,
          s.created_at
        FROM public.participants p
        INNER JOIN public.missions s ON s.id = p.mission_id
        INNER JOIN public.participant_segment_results psr
          ON psr.participant_id = p.id
         AND psr.segment_index = s.segment_index
        INNER JOIN public.campaign_occurrences o
          ON o.mission_id = s.id
        INNER JOIN public.campaign_members own
          ON own.campaign_id = o.campaign_id
         AND own.user_id = p.user_id
         AND own.status = 'active'
        WHERE s.id = v_live_mission_id
          AND p.user_id IS DISTINCT FROM v_uid
          AND psr.final_score IS NOT NULL
      ) run;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'personal_best', v_personal_best,
    'friends', coalesce(v_friends, '[]'::jsonb)
  );
END;
$function$;


-- 2. Campaign standings: report whether each score was modified.

CREATE OR REPLACE FUNCTION public.campaign_standings(p_campaign_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
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

  -- Prefer a live-mission score when both somehow exist (made_up ASC).
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'occurrence_id', scored.occurrence_id,
        'user_id', scored.user_id,
        'final_score', scored.final_score,
        'made_up', scored.made_up,
        'modified', scored.modified
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
      made_up,
      modified
    FROM (
      SELECT
        o.id AS occurrence_id,
        part.user_id,
        psr.final_score,
        false AS made_up,
        coalesce(cardinality(psr.modified_movements), 0) > 0 AS modified
      FROM public.campaign_occurrences o
      INNER JOIN public.missions s ON s.id = o.mission_id
      INNER JOIN public.participants part
        ON part.mission_id = s.id AND part.user_id IS NOT NULL
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
        true AS made_up,
        coalesce(cardinality(psr.modified_movements), 0) > 0 AS modified
      FROM public.campaign_makeups m
      INNER JOIN public.campaign_occurrences o ON o.id = m.occurrence_id
      INNER JOIN public.missions s ON s.id = m.mission_id
      INNER JOIN public.participants part
        ON part.mission_id = s.id AND part.user_id = m.user_id
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
$function$;


-- 3. My missions: carry the mark to the row.

CREATE OR REPLACE FUNCTION public.my_missions()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_missions jsonb;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'participant_id', p.id,
        'nickname', p.nickname,
        'joined_at', p.joined_at,
        'role', p.role,
        'mission_id', s.id,
        'created_at', s.created_at,
        'scheduled_at', s.scheduled_at,
        'is_featured', coalesce(s.is_featured, false),
        'duration_minutes', s.duration_minutes,
        'workout', s.workout,
        'template_id', s.template_id,
        'rally_point_id', s.rally_point_id,
        'chain_item_count', (
          SELECT count(*)::int
          FROM public.mission_chain_items c
          WHERE c.rally_point_id = s.rally_point_id
        ),
        'chain_unstarted_count', (
          SELECT count(*)::int
          FROM public.mission_chain_items c
          WHERE c.rally_point_id = s.rally_point_id
            AND c.started_mission_id IS NULL
        ),
        'state', s.state,
        'segment_index', s.segment_index,
        'round_count', (
          SELECT count(*)::int
          FROM public.rounds r
          WHERE r.participant_id = p.id AND r.segment_index = s.segment_index
        ),
        'partial_reps', coalesce(psr.partial_reps, 0),
        'final_score', psr.final_score,
        'score_breakdown', psr.score_breakdown,
        'modified_movements', psr.modified_movements,
        'coach_workout_name', cw.name
      )
      ORDER BY coalesce(s.scheduled_at, s.created_at) DESC
    ),
    '[]'::jsonb
  )
  INTO v_missions
  FROM public.participants p
  INNER JOIN public.missions s ON s.id = p.mission_id
  LEFT JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
    AND psr.segment_index = s.segment_index
  LEFT JOIN public.coach_workouts cw
    ON s.template_id = 'coach:' || cw.id::text
  WHERE p.user_id = v_uid
    -- Early-cancelled featured slots (finished with no score) stay out of
    -- the list; delete is one occurrence only and should not linger as a row.
    AND NOT (
      coalesce(s.is_featured, false)
      AND s.state = 'finished'
      AND psr.score_breakdown IS NULL
    );

  RETURN jsonb_build_object('ok', true, 'missions', v_missions);
END;
$function$;
