-- Vocabulary: a session is a mission, everywhere.
--
-- The app already called one AMRAP workout a "mission" in prose and a
-- "session" on every button, route and column, and CLAUDE.md carried a
-- paragraph explaining which to reach for. That paragraph was the tell: one
-- thing with two names is a translation step, and this is the second one we
-- have paid off after lobby/staging.
--
-- Mission wins because it is the word the brand already uses for the thing.
-- "Session" survives only in its generic sense --- an auth session in the
-- client, browser sessionStorage --- which is now unambiguous precisely
-- because nothing else claims the word.
--
-- Renames only, same shape as 20260901390000_rally_point_rename.sql:
-- ALTER ... RENAME carries privileges (including the column-level SELECT
-- grants Realtime depends on), publication membership, view dependencies and
-- policy expressions across untouched, so only names move. Functions are the
-- exception --- a plpgsql body stores its table references as text --- so
-- every function that reads a renamed object is recreated from the definition
-- the live schema currently holds, which means each one carries every patch
-- applied since it was first written rather than the original migration text.

-- 1. The table and every column that points at it.
ALTER TABLE public.sessions RENAME TO missions;
ALTER TABLE public.analytics_events RENAME COLUMN session_id TO mission_id;
ALTER TABLE public.assigned_workouts RENAME COLUMN session_id TO mission_id;
ALTER TABLE public.campaign_makeups RENAME COLUMN session_id TO mission_id;
ALTER TABLE public.campaign_occurrences RENAME COLUMN session_id TO mission_id;
ALTER TABLE public.campaigns RENAME COLUMN sessions_per_week TO missions_per_week;
ALTER TABLE public.messages RENAME COLUMN session_id TO mission_id;
ALTER TABLE public.participants RENAME COLUMN session_id TO mission_id;
ALTER TABLE public.rally_points RENAME COLUMN active_session_id TO active_mission_id;
ALTER TABLE public.rounds RENAME COLUMN session_id TO mission_id;

-- 2. Constraints and indexes.
ALTER TABLE public.analytics_events RENAME CONSTRAINT analytics_events_session_id_fkey TO analytics_events_mission_id_fkey;
ALTER TABLE public.assigned_workouts RENAME CONSTRAINT assigned_workouts_session_id_fkey TO assigned_workouts_mission_id_fkey;
ALTER TABLE public.campaign_makeups RENAME CONSTRAINT campaign_makeups_session_id_fkey TO campaign_makeups_mission_id_fkey;
ALTER TABLE public.campaign_occurrences RENAME CONSTRAINT campaign_occurrences_session_id_fkey TO campaign_occurrences_mission_id_fkey;
ALTER TABLE public.campaigns RENAME CONSTRAINT campaigns_sessions_per_week_range TO campaigns_missions_per_week_range;
ALTER TABLE public.messages RENAME CONSTRAINT messages_session_id_fkey TO messages_mission_id_fkey;
ALTER TABLE public.participants RENAME CONSTRAINT participants_session_id_fkey TO participants_mission_id_fkey;
ALTER TABLE public.participants RENAME CONSTRAINT participants_session_id_id_unique TO participants_mission_id_id_unique;
ALTER TABLE public.rally_points RENAME CONSTRAINT rally_points_active_session_id_fkey TO rally_points_active_mission_id_fkey;
ALTER TABLE public.rounds RENAME CONSTRAINT rounds_session_id_fkey TO rounds_mission_id_fkey;
ALTER TABLE public.rounds RENAME CONSTRAINT rounds_session_participant_consistency TO rounds_mission_participant_consistency;
ALTER TABLE public.missions RENAME CONSTRAINT sessions_pkey TO missions_pkey;
ALTER TABLE public.missions RENAME CONSTRAINT sessions_state_check TO missions_state_check;
ALTER TABLE public.missions RENAME CONSTRAINT sessions_duration_minutes_check TO missions_duration_minutes_check;
ALTER TABLE public.missions RENAME CONSTRAINT sessions_intensity_tier_range TO missions_intensity_tier_range;
ALTER TABLE public.missions RENAME CONSTRAINT sessions_rally_point_id_fkey TO missions_rally_point_id_fkey;
ALTER TABLE public.missions RENAME CONSTRAINT sessions_featured_schedule_id_fkey TO missions_featured_schedule_id_fkey;
ALTER TABLE public.missions RENAME CONSTRAINT sessions_campaign_occurrence_id_fkey TO missions_campaign_occurrence_id_fkey;

ALTER INDEX public.analytics_events_session_idx RENAME TO analytics_events_mission_idx;
ALTER INDEX public.campaign_makeups_session_uidx RENAME TO campaign_makeups_mission_uidx;
ALTER INDEX public.idx_messages_session_created RENAME TO idx_messages_mission_created;
ALTER INDEX public.idx_messages_session_id RENAME TO idx_messages_mission_id;
ALTER INDEX public.idx_participants_session_id RENAME TO idx_participants_mission_id;
ALTER INDEX public.idx_rounds_session_id RENAME TO idx_rounds_mission_id;
ALTER INDEX public.idx_sessions_rally_point_id RENAME TO idx_missions_rally_point_id;
ALTER INDEX public.idx_sessions_template_duration RENAME TO idx_missions_template_duration;
ALTER INDEX public.participants_session_rally_point_member_uidx RENAME TO participants_mission_rally_point_member_uidx;
ALTER INDEX public.sessions_campaign_occurrence_uidx RENAME TO missions_campaign_occurrence_uidx;
ALTER INDEX public.sessions_featured_schedule_time_uidx RENAME TO missions_featured_schedule_time_uidx;

ALTER POLICY sessions_select_anon ON public.missions RENAME TO missions_select_anon;

-- 3. Reporting views. A view stores a parsed tree, so the table and column
-- renames above are already transparent to it; only its own names move.
ALTER VIEW public.v_session_abandonment RENAME TO v_mission_abandonment;
ALTER VIEW public.v_mission_abandonment RENAME COLUMN sessions_finished TO missions_finished;
ALTER VIEW public.v_mission_abandonment RENAME COLUMN sessions_with_abandonment_event TO missions_with_abandonment_event;
ALTER VIEW public.v_host_vs_joiner_retention RENAME COLUMN avg_sessions_per_user TO avg_missions_per_user;
ALTER VIEW public.v_template_performance RENAME COLUMN sessions_created TO missions_created;
ALTER VIEW public.v_template_performance RENAME COLUMN sessions_completed TO missions_completed;

-- 4. Functions whose name or parameter list changes cannot be replaced in
-- place, so the old signatures go first.
DROP FUNCTION IF EXISTS public._rally_point_rotate_waiting_host(p_session_id uuid, p_new_host_user_id uuid);
DROP FUNCTION IF EXISTS public.available_ghosts(p_template_id text, p_duration_minutes integer, p_for_session_id uuid);
DROP FUNCTION IF EXISTS public.cancel_rally_point_countdown(p_session_id uuid, p_host_token text);
DROP FUNCTION IF EXISTS public.create_rally_point_session(p_duration_minutes integer, p_nickname text, p_workout jsonb, p_template_id text, p_intensity_tier integer, p_scheduled_at timestamp with time zone, p_timezone text);
DROP FUNCTION IF EXISTS public.create_session(p_duration_minutes integer, p_nickname text, p_workout jsonb);
DROP FUNCTION IF EXISTS public.create_session(p_duration_minutes integer, p_nickname text, p_workout jsonb, p_template_id text, p_intensity_tier integer);
DROP FUNCTION IF EXISTS public.create_session(p_duration_minutes integer, p_nickname text, p_workout jsonb, p_template_id text, p_intensity_tier integer, p_scheduled_at timestamp with time zone, p_timezone text);
DROP FUNCTION IF EXISTS public.delete_incomplete_session(p_session_id uuid);
DROP FUNCTION IF EXISTS public.ghost_curve_data(p_session_id uuid, p_participant_id uuid);
DROP FUNCTION IF EXISTS public.host_active_session_count();
DROP FUNCTION IF EXISTS public.host_scheduled_sessions();
DROP FUNCTION IF EXISTS public.join_session(p_session_id uuid, p_nickname text);
DROP FUNCTION IF EXISTS public.log_round(p_session_id uuid, p_participant_id uuid, p_claim_token text, p_round_index integer, p_elapsed_sec_at_round integer, p_segment_index integer);
DROP FUNCTION IF EXISTS public.my_sessions();
DROP FUNCTION IF EXISTS public.resume_session_identity(p_session_id uuid);
DROP FUNCTION IF EXISTS public.send_message(p_session_id uuid, p_participant_id uuid, p_claim_token text, p_body text);
DROP FUNCTION IF EXISTS public.session_participant_limit();
DROP FUNCTION IF EXISTS public.set_rally_point_countdown(p_session_id uuid, p_host_token text, p_seconds integer);
DROP FUNCTION IF EXISTS public.start_assigned_workout(p_assigned_workout_id uuid, p_session_id uuid);
DROP FUNCTION IF EXISTS public.start_next_rally_point_session(p_rally_point_id uuid, p_duration_minutes integer, p_workout jsonb, p_template_id text, p_intensity_tier integer);
DROP FUNCTION IF EXISTS public.submit_participant_result(p_session_id uuid, p_participant_id uuid, p_claim_token text, p_partial_reps integer, p_segment_index integer);
DROP FUNCTION IF EXISTS public.update_session_scheduled_at(p_session_id uuid, p_scheduled_at timestamp with time zone, p_timezone text);
DROP FUNCTION IF EXISTS public.update_session_state(p_session_id uuid, p_host_token text, p_state text, p_time_left_sec integer, p_is_paused boolean, p_started_at timestamp with time zone);

-- 5. Every function that names a renamed object, rebuilt.

CREATE OR REPLACE FUNCTION public._rally_point_rotate_waiting_host(p_mission_id uuid, p_new_host_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_state text;
  v_new_token text;
  v_new_participant uuid;
BEGIN
  IF p_mission_id IS NULL OR p_new_host_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT state INTO v_state
  FROM public.missions
  WHERE id = p_mission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_state IS DISTINCT FROM 'waiting' AND v_state IS DISTINCT FROM 'setup' THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_new_participant
  FROM public.participants
  WHERE mission_id = p_mission_id
    AND user_id = p_new_host_user_id
  ORDER BY joined_at ASC
  LIMIT 1;

  IF v_new_participant IS NULL THEN
    RETURN NULL;
  END IF;

  v_new_token := gen_random_uuid()::text;

  UPDATE public.missions
  SET host_token = v_new_token
  WHERE id = p_mission_id;

  UPDATE public.participants
  SET role = 'joiner'
  WHERE mission_id = p_mission_id
    AND role = 'host'
    AND id IS DISTINCT FROM v_new_participant;

  UPDATE public.participants
  SET role = 'host'
  WHERE id = v_new_participant;

  RETURN v_new_token;
END;
$function$;

CREATE OR REPLACE FUNCTION public.announce_next_mission(p_rally_point_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_rally_point public.rally_points%ROWTYPE;
  v_pending_at timestamptz;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_rally_point_id IS NULL THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  SELECT * INTO v_rally_point
  FROM public.rally_points
  WHERE id = p_rally_point_id
  FOR UPDATE;

  IF NOT FOUND OR v_rally_point.status <> 'open' THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  IF v_rally_point.host_user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Only the host can start the next mission';
  END IF;

  v_pending_at := now();

  UPDATE public.rally_points
  SET next_mission_pending_at = v_pending_at
  WHERE id = p_rally_point_id;

  RETURN jsonb_build_object(
    'ok', true,
    'rally_point_id', p_rally_point_id,
    'next_mission_pending_at', v_pending_at
  );
END;
$function$;

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

CREATE OR REPLACE FUNCTION public.campaign_detail(p_campaign_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
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
    'makeups', v_makeups
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.campaign_invite_preview(p_invite_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_code text;
  v_campaign public.campaigns%ROWTYPE;
  v_host text;
  v_members int;
  v_first date;
  v_last date;
BEGIN
  v_code := upper(btrim(coalesce(p_invite_code, '')));
  IF v_code = '' THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  SELECT * INTO v_campaign FROM public.campaigns WHERE invite_code = v_code;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  SELECT coalesce(p.nickname, p.username)
  INTO v_host
  FROM public.athlete_profiles p
  WHERE p.user_id = v_campaign.host_user_id;

  SELECT count(*)::int INTO v_members
  FROM public.campaign_members
  WHERE campaign_id = v_campaign.id AND status = 'active';

  SELECT min(local_date), max(local_date)
  INTO v_first, v_last
  FROM public.campaign_occurrences
  WHERE campaign_id = v_campaign.id;

  -- Deliberately narrow: name, shape and who is running it. Not the
  -- calendar and not the roster — holding the code is not membership.
  RETURN jsonb_build_object(
    'ok', true,
    'name', v_campaign.name,
    'goal', v_campaign.goal,
    'week_count', v_campaign.week_count,
    'missions_per_week', v_campaign.missions_per_week,
    'status', v_campaign.status,
    'host_nickname', v_host,
    'member_count', v_members,
    'member_limit', public.campaign_member_limit(),
    'first_mission_date', v_first,
    'last_mission_date', v_last
  );
END;
$function$;

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
        true AS made_up
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

CREATE OR REPLACE FUNCTION public.cancel_rally_point_countdown(p_mission_id uuid, p_host_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_host_token text;
  v_state text;
BEGIN
  IF p_mission_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT host_token, state
  INTO v_host_token, v_state
  FROM public.missions
  WHERE id = p_mission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF p_host_token IS NULL OR p_host_token <> v_host_token THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_host_token');
  END IF;

  IF v_state <> 'waiting' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'mission_not_waiting');
  END IF;

  UPDATE public.missions
  SET rally_point_countdown_ends_at = NULL
  WHERE id = p_mission_id AND host_token = p_host_token;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_participant(p_participant_id uuid, p_claim_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_mission_id uuid;
  v_claim_token_hash text;
  v_user_id uuid;
  v_hash text;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_participant_id IS NULL OR p_claim_token IS NULL THEN
    RAISE EXCEPTION 'Invalid claim';
  END IF;

  SELECT mission_id, claim_token_hash, user_id
  INTO v_mission_id, v_claim_token_hash, v_user_id
  FROM public.participants
  WHERE id = p_participant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participant not found';
  END IF;

  IF v_claim_token_hash IS NULL AND v_user_id = v_uid THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_claimed', true,
      'participant_id', p_participant_id,
      'mission_id', v_mission_id,
      'user_id', v_uid
    );
  END IF;

  IF v_claim_token_hash IS NULL AND v_user_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
  END IF;

  v_hash := encode(digest(p_claim_token, 'sha256'), 'hex');

  IF v_claim_token_hash IS NULL OR v_hash <> v_claim_token_hash THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_claim_token');
  END IF;

  UPDATE public.participants
  SET user_id = v_uid, claim_token_hash = NULL
  WHERE id = p_participant_id;

  RETURN jsonb_build_object(
    'ok', true,
    'participant_id', p_participant_id,
    'mission_id', v_mission_id,
    'user_id', v_uid
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_rally_point_command_if_stale(p_rally_point_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_rally_point public.rally_points%ROWTYPE;
  v_host_seen timestamptz;
  v_host_status text;
  v_grace interval := interval '45 seconds';
  v_host_token text;
  v_successor uuid;
  v_mission_state text;
  v_nickname text;
  v_participant_id uuid;
  v_claim_token text;
  v_claim_hash text;
  v_rotated text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_rally_point
  FROM public.rally_points
  WHERE id = p_rally_point_id
  FOR UPDATE;

  IF NOT FOUND OR v_rally_point.status <> 'open' THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.rally_point_members
    WHERE rally_point_id = p_rally_point_id
      AND user_id = v_uid
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not a rally point member';
  END IF;

  IF v_rally_point.host_user_id = v_uid THEN
    RETURN jsonb_build_object(
      'ok', true,
      'claimed', false,
      'host_user_id', v_uid,
      'reason', 'already_host'
    );
  END IF;

  SELECT last_seen_at, status
  INTO v_host_seen, v_host_status
  FROM public.rally_point_members
  WHERE rally_point_id = p_rally_point_id
    AND user_id = v_rally_point.host_user_id
  ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, joined_at DESC
  LIMIT 1;

  IF v_host_status IS DISTINCT FROM 'left'
     AND v_host_seen IS NOT NULL
     AND v_host_seen > (now() - v_grace)
  THEN
    RETURN jsonb_build_object(
      'ok', true,
      'claimed', false,
      'host_user_id', v_rally_point.host_user_id,
      'reason', 'host_present'
    );
  END IF;

  v_successor := public._rally_point_pick_successor(p_rally_point_id, v_rally_point.host_user_id);
  IF v_successor IS NULL THEN
    RAISE EXCEPTION 'No successor available';
  END IF;

  IF v_successor IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object(
      'ok', true,
      'claimed', false,
      'host_user_id', v_rally_point.host_user_id,
      'successor_user_id', v_successor,
      'reason', 'not_successor'
    );
  END IF;

  SELECT nickname INTO v_nickname
  FROM public.rally_point_members
  WHERE rally_point_id = p_rally_point_id
    AND user_id = v_uid
    AND status = 'active'
  LIMIT 1;

  IF v_nickname IS NULL THEN
    RAISE EXCEPTION 'Not a rally point member';
  END IF;

  v_host_token := NULL;

  IF v_rally_point.active_mission_id IS NOT NULL THEN
    SELECT state INTO v_mission_state
    FROM public.missions
    WHERE id = v_rally_point.active_mission_id
    FOR UPDATE;

    IF NOT FOUND THEN
      v_mission_state := NULL;
    ELSIF v_mission_state = 'work' THEN
      RAISE EXCEPTION 'Cannot claim command during a live mission';
    ELSIF v_mission_state IN ('waiting', 'setup') THEN
      SELECT id INTO v_participant_id
      FROM public.participants
      WHERE mission_id = v_rally_point.active_mission_id
        AND user_id = v_uid
      ORDER BY joined_at ASC
      LIMIT 1;

      IF v_participant_id IS NULL THEN
        v_claim_token :=
          replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
        v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

        INSERT INTO public.participants (mission_id, nickname, role, claim_token_hash, user_id)
        VALUES (
          v_rally_point.active_mission_id,
          v_nickname,
          'joiner',
          v_claim_hash,
          v_uid
        );
      END IF;

      UPDATE public.rally_points
      SET host_user_id = v_uid
      WHERE id = p_rally_point_id;

      v_rotated := public._rally_point_rotate_waiting_host(v_rally_point.active_mission_id, v_uid);
      IF v_rotated IS NULL THEN
        RAISE EXCEPTION 'Cannot claim command during a live mission';
      END IF;
      v_host_token := v_rotated;
    ELSIF v_mission_state = 'finished' THEN
      UPDATE public.rally_points
      SET host_user_id = v_uid
      WHERE id = p_rally_point_id;
    ELSE
      RAISE EXCEPTION 'Cannot claim command during a live mission';
    END IF;
  ELSE
    UPDATE public.rally_points
    SET host_user_id = v_uid
    WHERE id = p_rally_point_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'claimed', true,
    'rally_point_id', p_rally_point_id,
    'host_user_id', v_uid,
    'active_mission_id', v_rally_point.active_mission_id,
    'host_token', v_host_token
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.close_rally_point(p_rally_point_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_rally_point public.rally_points%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_rally_point
  FROM public.rally_points
  WHERE id = p_rally_point_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  IF v_rally_point.host_user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Only the host can close the staging area';
  END IF;

  UPDATE public.missions
  SET state = 'finished', is_paused = false, time_left_sec = 0
  WHERE rally_point_id = p_rally_point_id
    AND state IN ('waiting', 'setup');

  UPDATE public.rally_points
  SET status = 'closed',
      active_mission_id = NULL,
      next_mission_pending_at = NULL
  WHERE id = p_rally_point_id;

  UPDATE public.rally_point_members
  SET status = 'left'
  WHERE rally_point_id = p_rally_point_id
    AND status = 'active';

  RETURN jsonb_build_object('ok', true, 'rally_point_id', p_rally_point_id, 'status', 'closed');
END;
$function$;

CREATE OR REPLACE FUNCTION public.coach_dashboard()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'topStrip', jsonb_build_object(
      'missionsCreated7d', (
        SELECT count(*) FROM public.missions WHERE created_at >= now() - interval '7 days'
      ),
      'missionsCreated30d', (
        SELECT count(*) FROM public.missions WHERE created_at >= now() - interval '30 days'
      ),
      'missionsFinished7d', (
        SELECT count(*) FROM public.missions
        WHERE state = 'finished' AND created_at >= now() - interval '7 days'
      ),
      'missionsFinished30d', (
        SELECT count(*) FROM public.missions
        WHERE state = 'finished' AND created_at >= now() - interval '30 days'
      ),
      'uniqueAnonIds', (
        SELECT count(DISTINCT anon_id) FROM public.analytics_events WHERE anon_id IS NOT NULL
      ),
      'registeredUsers', (SELECT count(*) FROM public.athlete_profiles),
      'practiceMissionsStarted', (
        SELECT count(*) FROM public.analytics_events WHERE event_name = 'practice_started'
      ),
      'liveMissionsCreated', (
        SELECT count(*) FROM public.analytics_events WHERE event_name = 'mission_created'
      )
    ),
    'claimFunnel', (SELECT to_jsonb(v) FROM public.v_claim_funnel v),
    'intakeFunnel', (SELECT to_jsonb(v) FROM public.v_intake_funnel v),
    'rallyConversion', (SELECT to_jsonb(v) FROM public.v_rally_conversion v),
    'missionAbandonment', (SELECT to_jsonb(v) FROM public.v_mission_abandonment v),
    'templatePerformance', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.v_template_performance v
    ),
    'hostVsJoinerRetention', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.v_host_vs_joiner_retention v
    ),
    'audioUnlockRate', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.v_audio_unlock_rate v
    ),
    'rpcReliability', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.v_rpc_reliability v
    ),
    'realtimeReliability', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM public.v_realtime_reliability v
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.coach_events_recent(p_event_name text DEFAULT NULL::text, p_limit integer DEFAULT 100, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_limit int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_limit := LEAST(GREATEST(coalesce(p_limit, 100), 1), 200);

  RETURN jsonb_build_object(
    'ok', true,
    'events', (
      SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.occurred_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          ae.id,
          ae.event_name,
          ae.occurred_at,
          ae.mission_id,
          ae.participant_id,
          ae.user_id,
          ae.anon_id,
          ae.route,
          ae.props
        FROM public.analytics_events ae
        WHERE (p_event_name IS NULL OR ae.event_name = p_event_name)
          AND (
            p_user_id IS NULL
            OR ae.user_id = p_user_id
            OR ae.participant_id IN (
              SELECT id FROM public.participants WHERE user_id = p_user_id
            )
          )
        ORDER BY ae.occurred_at DESC
        LIMIT v_limit
      ) e
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.coach_featured_wod_attendees()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_schedule public.featured_wod_schedules%ROWTYPE;
  v_mission RECORD;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_schedule
  FROM public.featured_wod_schedules
  WHERE created_by = v_uid
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'missionId', NULL, 'attendees', '[]'::jsonb);
  END IF;

  SELECT id, scheduled_at, state
  INTO v_mission
  FROM public.missions
  WHERE featured_schedule_id = v_schedule.id
    AND state IN ('waiting', 'setup', 'work')
  ORDER BY scheduled_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'missionId', NULL, 'attendees', '[]'::jsonb);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'missionId', v_mission.id,
    'attendees', (
      SELECT coalesce(jsonb_agg(a ORDER BY a.joined_at ASC), '[]'::jsonb)
      FROM (
        SELECT p.nickname, p.role, p.joined_at
        FROM public.participants p
        WHERE p.mission_id = v_mission.id
      ) a
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.coach_set_featured_schedule(p_coach_workout_id uuid, p_days_of_week integer[], p_times_local text[], p_timezone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
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

  -- Materialize upcoming host rows so My Missions lists them immediately.
  PERFORM public.run_featured_wod_scheduler();

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
$function$;

CREATE OR REPLACE FUNCTION public.coach_upsert_workout(p_id uuid, p_name text, p_focus text, p_duration_minutes integer, p_intensity_tier integer, p_movements jsonb, p_tags text[], p_notes text, p_is_shared boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_name text;
  v_tags text[];
  v_bad_exercise_id text;
  v_row public.coach_workouts%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_name := trim(both from coalesce(p_name, ''));
  IF v_name = '' OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'Workout name must be 1-120 characters';
  END IF;
  IF p_duration_minutes IS NULL OR p_duration_minutes < 1 OR p_duration_minutes > 90 THEN
    RAISE EXCEPTION 'Duration must be between 1 and 90 minutes';
  END IF;
  IF p_intensity_tier IS NULL OR p_intensity_tier < 1 OR p_intensity_tier > 5 THEN
    RAISE EXCEPTION 'Intensity must be between 1 and 5';
  END IF;
  IF NOT public.validate_coach_workout_movements(p_movements) THEN
    RAISE EXCEPTION 'Invalid movement list';
  END IF;

  -- Any movement that links to a coachExerciseId must reference an
  -- exercise this coach owns, or one shared by another coach.
  SELECT m ->> 'coachExerciseId'
  INTO v_bad_exercise_id
  FROM jsonb_array_elements(p_movements) m
  WHERE (m ->> 'coachExerciseId') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.coach_exercises ce
      WHERE ce.id = (m ->> 'coachExerciseId')::uuid
        AND (ce.created_by = v_uid OR ce.is_shared = true)
    )
  LIMIT 1;

  IF v_bad_exercise_id IS NOT NULL THEN
    RAISE EXCEPTION 'Movement references an exercise you do not have access to';
  END IF;

  v_tags := (
    SELECT coalesce(array_agg(DISTINCT btrim(t)), '{}')
    FROM unnest(coalesce(p_tags, '{}')) t
    WHERE btrim(t) <> ''
  );

  IF p_id IS NOT NULL THEN
    IF public.coach_workout_is_locked(p_id) THEN
      RAISE EXCEPTION 'Workout is locked — it has a completed mission. Clone it to make changes.';
    END IF;

    UPDATE public.coach_workouts
    SET
      name = v_name,
      focus = p_focus,
      duration_minutes = p_duration_minutes,
      intensity_tier = p_intensity_tier,
      movements = p_movements,
      tags = v_tags,
      notes = p_notes,
      is_shared = coalesce(p_is_shared, false),
      updated_at = now()
    WHERE id = p_id AND created_by = v_uid
    RETURNING * INTO v_row;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Workout not found';
    END IF;
  ELSE
    INSERT INTO public.coach_workouts (
      created_by, name, focus, duration_minutes, intensity_tier, movements, tags, notes, is_shared
    )
    VALUES (v_uid, v_name, p_focus, p_duration_minutes, p_intensity_tier, p_movements, v_tags, p_notes, coalesce(p_is_shared, false))
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'workout', jsonb_build_object(
      'id', v_row.id,
      'name', v_row.name,
      'focus', v_row.focus,
      'durationMinutes', v_row.duration_minutes,
      'intensityTier', v_row.intensity_tier,
      'movements', v_row.movements,
      'tags', to_jsonb(v_row.tags),
      'notes', v_row.notes,
      'status', v_row.status,
      'isShared', v_row.is_shared,
      'isOwner', true,
      'isLocked', public.coach_workout_is_locked(v_row.id),
      'createdAt', v_row.created_at,
      'updatedAt', v_row.updated_at
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.coach_user_detail(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'profile', (
      SELECT jsonb_build_object(
        'userId', ap.user_id,
        'username', ap.username,
        'nickname', ap.nickname,
        'email', au.email,
        'heightCm', ap.height_cm,
        'weightKg', ap.weight_kg,
        'birthYear', ap.birth_year,
        'biologicalSex', ap.biological_sex,
        'perceivedClassification', ap.perceived_classification,
        'accountCreatedAt', ap.created_at
      )
      FROM public.athlete_profiles ap
      JOIN auth.users au ON au.id = ap.user_id
      WHERE ap.user_id = p_user_id
    ),
    'classificationHistory', (
      SELECT coalesce(jsonb_agg(h ORDER BY h.occurred_at DESC), '[]'::jsonb)
      FROM public.athlete_classification_history h
      WHERE h.user_id = p_user_id
    ),
    'missions', (
      SELECT coalesce(jsonb_agg(s ORDER BY s.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          se.id AS mission_id,
          p.role,
          se.template_id,
          se.intensity_tier,
          se.duration_minutes,
          se.state,
          psr.final_score,
          se.created_at,
          p.joined_at
        FROM public.participants p
        JOIN public.missions se ON se.id = p.mission_id
        LEFT JOIN public.participant_segment_results psr
          ON psr.participant_id = p.id AND psr.segment_index = se.segment_index
        WHERE p.user_id = p_user_id
      ) s
    ),
    'summary', jsonb_build_object(
      'missionsAsHost', (
        SELECT count(DISTINCT p.mission_id)
        FROM public.participants p
        WHERE p.user_id = p_user_id AND p.role = 'host'
      ),
      'missionsAsJoiner', (
        SELECT count(DISTINCT p.mission_id)
        FROM public.participants p
        WHERE p.user_id = p_user_id AND p.role = 'joiner'
      ),
      'totalMissions', (
        SELECT count(DISTINCT p.mission_id)
        FROM public.participants p
        WHERE p.user_id = p_user_id
      ),
      'practiceMissionsStarted', (
        SELECT count(*)
        FROM public.analytics_events
        WHERE event_name = 'practice_started'
          AND (
            user_id = p_user_id
            OR participant_id IN (
              SELECT id FROM public.participants WHERE user_id = p_user_id
            )
          )
      ),
      'firstSeenAt', (
        SELECT min(p.joined_at) FROM public.participants p WHERE p.user_id = p_user_id
      ),
      'lastActiveAt', (
        SELECT max(p.joined_at) FROM public.participants p WHERE p.user_id = p_user_id
      )
    ),
    'overtraining', public.compute_overtraining_load(p_user_id, 'UTC')
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.coach_users_list(p_search text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_activity_bucket text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_limit int;
  v_search text;
  v_bucket text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_limit := LEAST(GREATEST(coalesce(p_limit, 50), 1), 200);
  v_search := nullif(btrim(coalesce(p_search, '')), '');
  v_bucket := nullif(btrim(coalesce(p_activity_bucket, '')), '');

  IF v_bucket IS NOT NULL AND v_bucket NOT IN ('last_24h', 'last_3d', 'last_7d', 'lapsed') THEN
    RAISE EXCEPTION 'Invalid activity bucket';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'users', (
      WITH last_activity AS (
        SELECT
          ap.user_id,
          NULLIF(
            GREATEST(
              coalesce(ps.last_participant_at, '-infinity'::timestamptz),
              coalesce(pa.last_pa_at, '-infinity'::timestamptz),
              coalesce(ev.last_event_at, '-infinity'::timestamptz)
            ),
            '-infinity'::timestamptz
          ) AS last_active_at
        FROM public.athlete_profiles ap
        LEFT JOIN (
          SELECT user_id, max(joined_at) AS last_participant_at
          FROM public.participants
          WHERE user_id IS NOT NULL
          GROUP BY user_id
        ) ps ON ps.user_id = ap.user_id
        LEFT JOIN (
          SELECT user_id, max(occurred_at) AS last_pa_at
          FROM public.physical_activity_log
          GROUP BY user_id
        ) pa ON pa.user_id = ap.user_id
        LEFT JOIN (
          SELECT user_id, max(occurred_at) AS last_event_at
          FROM public.analytics_events
          WHERE user_id IS NOT NULL
          GROUP BY user_id
        ) ev ON ev.user_id = ap.user_id
      )
      SELECT coalesce(jsonb_agg(u ORDER BY u.last_active_at DESC NULLS LAST), '[]'::jsonb)
      FROM (
        SELECT
          ap.user_id,
          ap.username,
          ap.nickname,
          au.email,
          ap.perceived_classification,
          ap.created_at AS account_created_at,
          la.last_active_at,
          coalesce(mission_counts.total_missions, 0) AS total_missions
        FROM public.athlete_profiles ap
        JOIN auth.users au ON au.id = ap.user_id
        LEFT JOIN last_activity la ON la.user_id = ap.user_id
        LEFT JOIN (
          SELECT p.user_id, count(DISTINCT p.mission_id) AS total_missions
          FROM public.participants p
          WHERE p.user_id IS NOT NULL
          GROUP BY p.user_id
        ) mission_counts ON mission_counts.user_id = ap.user_id
        WHERE
          (
            v_search IS NULL
            OR ap.username ILIKE '%' || v_search || '%'
            OR ap.nickname ILIKE '%' || v_search || '%'
            OR au.email ILIKE '%' || v_search || '%'
          )
          AND (
            v_bucket IS NULL
            OR (v_bucket = 'last_24h' AND la.last_active_at >= now() - interval '1 day')
            OR (v_bucket = 'last_3d' AND la.last_active_at >= now() - interval '3 days')
            OR (v_bucket = 'last_7d' AND la.last_active_at >= now() - interval '7 days')
            OR (
              v_bucket = 'lapsed'
              AND (la.last_active_at IS NULL OR la.last_active_at < now() - interval '7 days')
            )
          )
        ORDER BY la.last_active_at DESC NULLS LAST, ap.created_at DESC
        LIMIT v_limit
      ) u
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.coach_workout_history(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
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

  IF NOT EXISTS (
    SELECT 1 FROM public.coach_workouts WHERE id = p_id AND created_by = v_uid
  ) THEN
    RAISE EXCEPTION 'Workout not found';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'missions', (
      SELECT coalesce(jsonb_agg(s ORDER BY s.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          se.id AS mission_id,
          p.nickname,
          p.role,
          se.state,
          psr.final_score,
          se.created_at
        FROM public.missions se
        INNER JOIN public.participants p ON p.mission_id = se.id
        LEFT JOIN public.participant_segment_results psr
          ON psr.participant_id = p.id AND psr.segment_index = se.segment_index
        WHERE se.template_id = 'coach:' || p_id::text
      ) s
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.coach_workout_is_locked(p_workout_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.missions se
    WHERE se.template_id = 'coach:' || p_workout_id::text
      AND se.state = 'finished'
  );
$function$;

CREATE OR REPLACE FUNCTION public.compute_overtraining_load(p_user_id uuid, p_timezone text DEFAULT 'UTC'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_tz text;
  v_local_today date;
  v_amrap_load_7d numeric;
  v_pa_load_7d numeric;
  v_acute_load_7d numeric;
  v_amrap_load_28d numeric;
  v_pa_load_28d numeric;
  v_chronic_weekly_load_28d numeric;
  v_consecutive_hard_days int;
  v_day_offset int;
  v_is_hard_day boolean;
BEGIN
  -- Copilot suggestion ignored: callers already validate timezone (hud_telemetry) or pass UTC (coach_user_detail), and reject null user ids before invoke — matches classification_quotas trust-caller pattern.
  v_tz := coalesce(nullif(btrim(coalesce(p_timezone, '')), ''), 'UTC');
  v_local_today := (now() AT TIME ZONE v_tz)::date;

  SELECT coalesce(sum(s.duration_minutes * coalesce(s.intensity_tier, 2)), 0)
  INTO v_amrap_load_7d
  FROM public.participants p
  INNER JOIN public.missions s ON s.id = p.mission_id
  INNER JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
   AND psr.segment_index = s.segment_index
  WHERE p.user_id = p_user_id
    AND psr.score_breakdown IS NOT NULL
    AND psr.updated_at >= now() - interval '7 days';

  SELECT coalesce(sum(duration_minutes * intensity_tier), 0)
  INTO v_pa_load_7d
  FROM public.physical_activity_log
  WHERE user_id = p_user_id
    AND occurred_at >= now() - interval '7 days';

  v_acute_load_7d := v_amrap_load_7d + v_pa_load_7d;

  SELECT coalesce(sum(s.duration_minutes * coalesce(s.intensity_tier, 2)), 0)
  INTO v_amrap_load_28d
  FROM public.participants p
  INNER JOIN public.missions s ON s.id = p.mission_id
  INNER JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
   AND psr.segment_index = s.segment_index
  WHERE p.user_id = p_user_id
    AND psr.score_breakdown IS NOT NULL
    AND psr.updated_at >= now() - interval '28 days';

  SELECT coalesce(sum(duration_minutes * intensity_tier), 0)
  INTO v_pa_load_28d
  FROM public.physical_activity_log
  WHERE user_id = p_user_id
    AND occurred_at >= now() - interval '28 days';

  v_chronic_weekly_load_28d := (v_amrap_load_28d + v_pa_load_28d) / 4.0;

  -- Consecutive local-calendar days (ending today) with any intensity-4+
  -- activity from either source. Loop bound of 14 is a safety cap well
  -- past the 5-day rest-day threshold the client-side evaluator uses.
  v_consecutive_hard_days := 0;
  FOR v_day_offset IN 0..13 LOOP
    SELECT
      EXISTS (
        SELECT 1
        FROM public.participants p
        INNER JOIN public.missions s ON s.id = p.mission_id
        INNER JOIN public.participant_segment_results psr
          ON psr.participant_id = p.id
         AND psr.segment_index = s.segment_index
        WHERE p.user_id = p_user_id
          AND psr.score_breakdown IS NOT NULL
          AND coalesce(s.intensity_tier, 2) >= 4
          AND psr.updated_at >= ((v_local_today - v_day_offset)::timestamp AT TIME ZONE v_tz)
          AND psr.updated_at < ((v_local_today - v_day_offset + 1)::timestamp AT TIME ZONE v_tz)
      )
      OR EXISTS (
        SELECT 1
        FROM public.physical_activity_log pal
        WHERE pal.user_id = p_user_id
          AND pal.intensity_tier >= 4
          AND pal.occurred_at >= ((v_local_today - v_day_offset)::timestamp AT TIME ZONE v_tz)
          AND pal.occurred_at < ((v_local_today - v_day_offset + 1)::timestamp AT TIME ZONE v_tz)
      )
    INTO v_is_hard_day;

    EXIT WHEN NOT v_is_hard_day;
    v_consecutive_hard_days := v_consecutive_hard_days + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'acuteLoad7d', v_acute_load_7d,
    'chronicWeeklyLoad28d', v_chronic_weekly_load_28d,
    'consecutiveHighIntensityDays', v_consecutive_hard_days
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_campaign(p_name text, p_goal text, p_week_count integer, p_start_date date, p_timezone text, p_occurrences jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_name text;
  v_goal text;
  v_tz text;
  v_active int;
  v_len int;
  v_elem jsonb;
  v_missions_per_week int;
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
    RAISE EXCEPTION 'A campaign must have between 1 and 60 missions';
  END IF;

  -- The client builds the calendar (buildCampaignCalendar), so the shape is
  -- re-derived and re-checked here rather than trusted.
  IF v_len % p_week_count <> 0 THEN
    RAISE EXCEPTION 'Schedule does not divide evenly into the campaign length';
  END IF;

  v_missions_per_week := v_len / p_week_count;
  IF v_missions_per_week < 1 OR v_missions_per_week > 5 THEN
    RAISE EXCEPTION 'A campaign needs 1 to 5 missions a week';
  END IF;

  v_expected := p_week_count * v_missions_per_week;
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
      RAISE EXCEPTION 'Invalid mission in the campaign schedule';
    END IF;

    IF (v_elem ->> 'sequence')::int IS DISTINCT FROM (i + 1) THEN
      RAISE EXCEPTION 'Campaign missions must be numbered 1 to %', v_len;
    END IF;

    IF NOT public.validate_workout(v_elem -> 'workout') THEN
      RAISE EXCEPTION 'Invalid workout format in mission %', i + 1;
    END IF;

    IF (v_elem ->> 'duration_minutes')::int IS NULL
       OR (v_elem ->> 'duration_minutes')::int < 1
       OR (v_elem ->> 'duration_minutes')::int > 60
    THEN
      RAISE EXCEPTION 'Mission % duration must be between 1 and 60 minutes', i + 1;
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
    host_user_id, name, goal, week_count, missions_per_week,
    start_date, timezone, status, invite_code
  )
  VALUES (
    v_uid, v_name, v_goal, p_week_count, v_missions_per_week,
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
    'missions_per_week', v_missions_per_week,
    'total_missions', v_len
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_rally_point_mission(p_duration_minutes integer, p_nickname text, p_workout jsonb, p_template_id text, p_intensity_tier integer, p_scheduled_at timestamp with time zone, p_timezone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_rally_point_id uuid;
  v_mission_id uuid;
  v_host_token text;
  v_participant_id uuid;
  v_member_id uuid;
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
       OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_timezone)
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

  INSERT INTO public.rally_points (host_user_id, status)
  VALUES (v_uid, 'open')
  RETURNING id INTO v_rally_point_id;

  INSERT INTO public.rally_point_members (rally_point_id, user_id, nickname, status, last_seen_at)
  VALUES (v_rally_point_id, v_uid, v_nickname, 'active', now())
  RETURNING id INTO v_member_id;

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
    scheduled_at,
    rally_point_id
  )
  VALUES (
    v_host_token,
    p_duration_minutes,
    p_workout,
    v_template_id,
    v_intensity_tier,
    'waiting',
    10,
    p_scheduled_at,
    v_rally_point_id
  )
  RETURNING id INTO v_mission_id;

  UPDATE public.rally_points
  SET active_mission_id = v_mission_id
  WHERE id = v_rally_point_id;

  INSERT INTO public.participants
    (mission_id, nickname, role, claim_token_hash, user_id, rally_point_member_id)
  VALUES (v_mission_id, v_nickname, 'host', v_claim_hash, v_uid, v_member_id)
  RETURNING id INTO v_participant_id;

  RETURN jsonb_build_object(
    'rally_point_id', v_rally_point_id,
    'rally_point_member_id', v_member_id,
    'mission_id', v_mission_id,
    'host_token', v_host_token,
    'participant_id', v_participant_id,
    'claim_token', v_claim_token
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_mission(p_duration_minutes integer, p_nickname text, p_workout jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
BEGIN
  RETURN public.create_mission(p_duration_minutes, p_nickname, p_workout, NULL, NULL);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_mission(p_duration_minutes integer, p_nickname text, p_workout jsonb, p_template_id text DEFAULT NULL::text, p_intensity_tier integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
BEGIN
  RETURN public.create_mission(
    p_duration_minutes,
    p_nickname,
    p_workout,
    p_template_id,
    p_intensity_tier,
    NULL,
    NULL
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_mission(p_duration_minutes integer, p_nickname text, p_workout jsonb, p_template_id text, p_intensity_tier integer, p_scheduled_at timestamp with time zone, p_timezone text)
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

  -- Copilot suggestion ignored: extracting a shared cap helper would be new abstraction; create_mission and host_active_mission_count already duplicated this predicate before makeups.
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

CREATE OR REPLACE FUNCTION public.current_featured_wod()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_schedule public.featured_wod_schedules%ROWTYPE;
  v_workout public.coach_workouts%ROWTYPE;
  v_mission RECORD;
  v_next timestamptz;
  v_attendee_count int;
  v_setup_sec int := 10;
BEGIN
  SELECT * INTO v_schedule
  FROM public.featured_wod_schedules
  WHERE active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'featured', NULL);
  END IF;

  SELECT * INTO v_workout
  FROM public.coach_workouts
  WHERE id = v_schedule.coach_workout_id;

  IF NOT FOUND OR v_workout.status <> 'published' THEN
    RETURN jsonb_build_object('ok', true, 'featured', NULL);
  END IF;

  -- Prefer an active / upcoming generated mission (includes setup).
  SELECT id, scheduled_at, state, started_at
  INTO v_mission
  FROM public.missions
  WHERE featured_schedule_id = v_schedule.id
    AND state IN ('waiting', 'setup', 'work')
  ORDER BY scheduled_at ASC
  LIMIT 1;

  -- Else surface a naturally-ended occurrence briefly (work window over),
  -- so the card can show "AMRAP ended." Coach-cancelled rows finished
  -- before work end are skipped → fall through to next-occurrence preview.
  IF NOT FOUND THEN
    SELECT id, scheduled_at, state, started_at
    INTO v_mission
    FROM public.missions
    WHERE featured_schedule_id = v_schedule.id
      AND state = 'finished'
      AND scheduled_at IS NOT NULL
      AND scheduled_at
        + (v_setup_sec * interval '1 second')
        + (duration_minutes * interval '1 minute')
        <= now()
      AND scheduled_at
        + (v_setup_sec * interval '1 second')
        + (duration_minutes * interval '1 minute')
        + interval '2 hours'
        > now()
    ORDER BY scheduled_at DESC
    LIMIT 1;
  END IF;

  IF FOUND THEN
    SELECT count(*)::int INTO v_attendee_count
    FROM public.participants
    WHERE mission_id = v_mission.id;

    RETURN jsonb_build_object(
      'ok', true,
      'featured', jsonb_build_object(
        'workoutName', v_workout.name,
        'focus', v_workout.focus,
        'durationMinutes', v_workout.duration_minutes,
        'intensityTier', v_workout.intensity_tier,
        'tags', to_jsonb(v_workout.tags),
        'scheduledAt', v_mission.scheduled_at,
        'missionId', v_mission.id,
        'state', v_mission.state,
        'startedAt', v_mission.started_at,
        'attendeeCount', v_attendee_count
      )
    );
  END IF;

  v_next := public.featured_wod_next_occurrence(v_schedule);
  IF v_next IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'featured', NULL);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'featured', jsonb_build_object(
      'workoutName', v_workout.name,
      'focus', v_workout.focus,
      'durationMinutes', v_workout.duration_minutes,
      'intensityTier', v_workout.intensity_tier,
      'tags', to_jsonb(v_workout.tags),
      'scheduledAt', v_next,
      'missionId', NULL,
      'state', NULL,
      'startedAt', NULL,
      'attendeeCount', NULL
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_campaign(p_campaign_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_campaign public.campaigns%ROWTYPE;
  v_deleted int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_campaign
  FROM public.campaigns
  WHERE id = p_campaign_id
  FOR UPDATE;

  IF NOT FOUND OR v_campaign.host_user_id <> v_uid THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  -- These two checks exist for their error messages; the DELETE below repeats
  -- them as its own precondition, which is what actually makes the decision.
  IF EXISTS (
    SELECT 1 FROM public.campaign_occurrences
    WHERE campaign_id = p_campaign_id
      AND (status <> 'planned' OR mission_id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Campaign already started';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.campaign_members
    WHERE campaign_id = p_campaign_id
      AND status = 'active'
      AND user_id <> v_uid
  ) THEN
    RAISE EXCEPTION 'Campaign has other athletes';
  END IF;

  -- Guarded in the statement rather than only above it: the cron generator does
  -- not lock the campaign row, so a mission could be created between the checks
  -- and here. It inserts the mission and stamps the occurrence in one
  -- transaction, so re-evaluating the condition at statement time sees both or
  -- neither, and a delete that would have orphaned a live mission deletes
  -- nothing instead.
  DELETE FROM public.campaigns c
  WHERE c.id = p_campaign_id
    AND c.host_user_id = v_uid
    AND NOT EXISTS (
      SELECT 1 FROM public.campaign_occurrences o
      WHERE o.campaign_id = c.id
        AND (o.status <> 'planned' OR o.mission_id IS NOT NULL)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.campaign_members m
      WHERE m.campaign_id = c.id
        AND m.status = 'active'
        AND m.user_id <> v_uid
    );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    RAISE EXCEPTION 'Campaign already started';
  END IF;

  -- campaign_occurrences and campaign_members cascade from campaigns.
  RETURN jsonb_build_object('ok', true, 'campaign_id', p_campaign_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_incomplete_mission(p_mission_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_segment_index int;
  v_is_featured boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_mission_id IS NULL THEN
    RAISE EXCEPTION 'Mission id is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.participants p
    WHERE p.mission_id = p_mission_id
      AND p.user_id = v_uid
      AND p.role = 'host'
  ) THEN
    RAISE EXCEPTION 'Only the host can delete this mission';
  END IF;

  SELECT s.segment_index, s.is_featured
  INTO v_segment_index, v_is_featured
  FROM public.missions s
  WHERE s.id = p_mission_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission not found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.participants p
    INNER JOIN public.participant_segment_results psr
      ON psr.participant_id = p.id
     AND psr.segment_index = v_segment_index
    WHERE p.mission_id = p_mission_id
      AND psr.score_breakdown IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Completed missions cannot be deleted';
  END IF;

  -- Featured: finish in place so (featured_schedule_id, scheduled_at) stays
  -- occupied and run_featured_wod_scheduler cannot recreate the occurrence.
  IF v_is_featured THEN
    UPDATE public.missions
    SET
      state = 'finished',
      is_paused = false,
      time_left_sec = 0,
      started_at = NULL
    WHERE id = p_mission_id;

    RETURN jsonb_build_object('ok', true, 'cancelledFeatured', true);
  END IF;

  DELETE FROM public.missions
  WHERE id = p_mission_id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.end_campaign(p_campaign_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_campaign public.campaigns%ROWTYPE;
  v_skipped int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Locked against a concurrent join_campaign, which takes the same lock.
  SELECT * INTO v_campaign
  FROM public.campaigns
  WHERE id = p_campaign_id
  FOR UPDATE;

  -- Same error for "no such campaign" and "not yours", so a stranger cannot
  -- probe which campaign ids exist. This is the campaign_detail pattern.
  IF NOT FOUND OR v_campaign.host_user_id <> v_uid THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  IF v_campaign.status IN ('complete', 'abandoned') THEN
    RAISE EXCEPTION 'Campaign closed';
  END IF;

  UPDATE public.campaigns
  SET status = 'abandoned', updated_at = now()
  WHERE id = p_campaign_id;

  -- The scheduler only ages planned occurrences out of the schedule while the
  -- campaign is active, so without this they would sit at 'planned' forever and
  -- the detail page would keep promising missions that can never run. Their
  -- window will never open now, which is what 'skipped' means.
  --
  -- Occurrences already generated are left alone: a mission exists, and the
  -- scheduler's finish and classify passes do not filter on campaign status, so
  -- they still reach 'done' or 'skipped' on their own.
  UPDATE public.campaign_occurrences
  SET status = 'skipped'
  WHERE campaign_id = p_campaign_id
    AND status = 'planned'
    AND mission_id IS NULL;

  GET DIAGNOSTICS v_skipped = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'campaign_id', p_campaign_id,
    'status', 'abandoned',
    'skipped_missions', v_skipped
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.featured_wod_next_occurrence(p_schedule featured_wod_schedules)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_day date;
  v_dow int;
  v_time text;
  v_candidate timestamptz;
  v_best timestamptz := NULL;
  i int;
BEGIN
  FOR i IN 0..7 LOOP
    v_day := (now() AT TIME ZONE p_schedule.timezone)::date + i;
    v_dow := EXTRACT(DOW FROM v_day)::int;
    IF NOT (v_dow = ANY (p_schedule.days_of_week)) THEN
      CONTINUE;
    END IF;

    FOREACH v_time IN ARRAY p_schedule.times_local LOOP
      v_candidate := (v_day::text || ' ' || v_time)::timestamp AT TIME ZONE p_schedule.timezone;
      IF v_candidate <= now() - interval '2 minutes' THEN
        CONTINUE;
      END IF;
      -- Occupied slots (waiting, finished/cancelled, etc.) are not "next".
      IF EXISTS (
        SELECT 1
        FROM public.missions s
        WHERE s.featured_schedule_id = p_schedule.id
          AND s.scheduled_at = v_candidate
      ) THEN
        CONTINUE;
      END IF;
      IF v_best IS NULL OR v_candidate < v_best THEN
        v_best := v_candidate;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_best;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_rally_point(p_rally_point_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_rally_point public.rally_points%ROWTYPE;
  v_members jsonb;
  v_active_mission_state text;
  v_uid uuid;
  v_is_anon boolean;
BEGIN
  v_uid := auth.uid();
  v_is_anon := v_uid IS NULL;

  IF p_rally_point_id IS NULL THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  SELECT * INTO v_rally_point FROM public.rally_points WHERE id = p_rally_point_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  v_active_mission_state := NULL;
  IF v_rally_point.active_mission_id IS NOT NULL THEN
    SELECT state INTO v_active_mission_state
    FROM public.missions
    WHERE id = v_rally_point.active_mission_id;
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'user_id', CASE WHEN v_is_anon THEN NULL ELSE m.user_id END,
        'nickname', m.nickname,
        'status', m.status,
        'last_seen_at', m.last_seen_at,
        'joined_at', m.joined_at
      )
      ORDER BY m.joined_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_members
  FROM public.rally_point_members m
  WHERE m.rally_point_id = p_rally_point_id
    AND m.status = 'active';

  RETURN jsonb_build_object(
    'ok', true,
    'rally_point_id', v_rally_point.id,
    'host_user_id', CASE WHEN v_is_anon THEN NULL ELSE v_rally_point.host_user_id END,
    'active_mission_id', v_rally_point.active_mission_id,
    'active_mission_state', v_active_mission_state,
    'status', v_rally_point.status,
    'created_at', v_rally_point.created_at,
    'updated_at', v_rally_point.updated_at,
    'next_mission_pending_at', v_rally_point.next_mission_pending_at,
    'members', v_members
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.ghost_curve_data(p_mission_id uuid, p_participant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_owner uuid;
  v_mission public.missions%ROWTYPE;
  v_partial_reps int;
  v_rounds jsonb;
  v_allowed boolean := false;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT p.user_id
  INTO v_owner
  FROM public.participants p
  WHERE p.id = p_participant_id
    AND p.mission_id = p_mission_id;

  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'participant_not_found');
  END IF;

  IF v_owner = v_uid THEN
    v_allowed := true;
  ELSE
    -- Requester has a makeup for the occurrence whose live mission is p_mission_id,
    -- and both athletes are still active on that campaign. The makeup mission
    -- itself is never a legal ghost source.
    SELECT true
    INTO v_allowed
    FROM public.campaign_makeups mk
    INNER JOIN public.campaign_occurrences o ON o.id = mk.occurrence_id
    INNER JOIN public.campaign_members req
      ON req.campaign_id = o.campaign_id
     AND req.user_id = v_uid
     AND req.status = 'active'
    INNER JOIN public.campaign_members own
      ON own.campaign_id = o.campaign_id
     AND own.user_id = v_owner
     AND own.status = 'active'
    WHERE mk.user_id = v_uid
      AND o.mission_id = p_mission_id;

    v_allowed := coalesce(v_allowed, false);
  END IF;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT *
  INTO v_mission
  FROM public.missions
  WHERE id = p_mission_id;

  IF v_mission.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'mission_not_found');
  END IF;

  SELECT coalesce(psr.partial_reps, 0)
  INTO v_partial_reps
  FROM public.participant_segment_results psr
  WHERE psr.participant_id = p_participant_id
    AND psr.segment_index = v_mission.segment_index;

  IF v_partial_reps IS NULL THEN
    v_partial_reps := 0;
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'round_index', r.round_index,
        'elapsed_sec_at_round', r.elapsed_sec_at_round
      )
      ORDER BY r.round_index ASC
    ),
    '[]'::jsonb
  )
  INTO v_rounds
  FROM public.rounds r
  WHERE r.participant_id = p_participant_id
    AND r.segment_index = v_mission.segment_index;

  RETURN jsonb_build_object(
    'ok', true,
    'mission_id', p_mission_id,
    'participant_id', p_participant_id,
    'segment_index', v_mission.segment_index,
    'duration_minutes', v_mission.duration_minutes,
    'workout', v_mission.workout,
    'partial_reps', v_partial_reps,
    'rounds', v_rounds
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.host_active_mission_count()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
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

  RETURN jsonb_build_object('ok', true, 'count', coalesce(v_active, 0));
END;
$function$;

CREATE OR REPLACE FUNCTION public.host_scheduled_missions()
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
        'mission_id', s.id,
        'scheduled_at', s.scheduled_at,
        'created_at', s.created_at,
        'duration_minutes', s.duration_minutes,
        'workout', s.workout,
        'state', s.state
      )
      ORDER BY s.scheduled_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_missions
  FROM public.missions s
  INNER JOIN public.participants p
    ON p.mission_id = s.id
   AND p.role = 'host'
   AND p.user_id = v_uid
  WHERE s.scheduled_at IS NOT NULL
    AND s.state IN ('waiting', 'setup', 'work');

  RETURN jsonb_build_object('ok', true, 'missions', v_missions);
END;
$function$;

CREATE OR REPLACE FUNCTION public.hud_telemetry(p_timezone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_local_today date;
  v_week_start_local date;
  v_week_start_ts timestamptz;
  v_week_end_ts timestamptz;
  v_prev_week_start_local date;
  v_prev_week_start_ts timestamptz;
  v_prev_week_end_ts timestamptz;
  v_week_minutes int;
  v_week_pvi_average numeric;
  v_last_locked_at timestamptz;
  v_attrition jsonb;
  v_domain_5 int;
  v_domain_10 int;
  v_domain_15 int;
  v_domain_20 int;
  v_domain_other int;
  v_i3_plus int;
  v_i4_plus int;
  v_marathon_20 int;
  v_prev_minutes int;
  v_prev_i3_plus int;
  v_prev_i4_plus int;
  v_prev_marathon_20 int;
  v_current_rank text;
  v_previous_rank text;
  v_last_verified_rank text;
  v_birth_year int;
  v_sex text;
  v_age int;
  v_civilian_minutes int;
  v_operator_minutes int;
  v_operator_i3 int;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_timezone IS NULL
     OR btrim(p_timezone) = ''
     OR NOT EXISTS (
       SELECT 1
       FROM pg_timezone_names
       WHERE name = p_timezone
     )
  THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_timezone');
  END IF;

  SELECT birth_year, biological_sex
  INTO v_birth_year, v_sex
  FROM public.athlete_profiles
  WHERE user_id = v_uid;

  IF NOT FOUND THEN
    v_age := 22;
    v_sex := 'M';
  ELSE
    -- Copilot suggestion ignored: local calendar year on the client mirrors this DB year extract; exact TZ alignment is out of scope for classification quotas.
    v_age := extract(year FROM now())::int - v_birth_year;
    v_sex := coalesce(v_sex, 'M');
  END IF;

  SELECT q.civilian_minutes, q.operator_minutes, q.operator_i3
  INTO v_civilian_minutes, v_operator_minutes, v_operator_i3
  FROM public.classification_quotas(v_age, v_sex) AS q;

  v_local_today := (now() AT TIME ZONE p_timezone)::date;
  -- ISO Monday = 1 … Sunday = 7
  v_week_start_local :=
    v_local_today - ((extract(isodow FROM v_local_today)::int) - 1);

  -- Monday 00:00 local → timestamptz; next Monday 00:00 is exclusive end
  v_week_start_ts := (v_week_start_local::timestamp AT TIME ZONE p_timezone);
  v_week_end_ts := ((v_week_start_local + 7)::timestamp AT TIME ZONE p_timezone);

  v_prev_week_start_local := v_week_start_local - 7;
  v_prev_week_start_ts := (v_prev_week_start_local::timestamp AT TIME ZONE p_timezone);
  v_prev_week_end_ts := v_week_start_ts;

  SELECT
    coalesce(sum(s.duration_minutes), 0)::int,
    avg(
      CASE
        WHEN jsonb_typeof(psr.score_breakdown -> 'pvi') = 'number'
        THEN (psr.score_breakdown ->> 'pvi')::numeric
        ELSE NULL
      END
    ),
    coalesce(
      count(*) FILTER (
        WHERE coalesce(s.intensity_tier, 2) >= 3
      ),
      0
    )::int,
    coalesce(
      count(*) FILTER (
        WHERE coalesce(s.intensity_tier, 2) >= 4
      ),
      0
    )::int,
    coalesce(
      count(*) FILTER (WHERE s.duration_minutes = 20),
      0
    )::int
  INTO
    v_week_minutes,
    v_week_pvi_average,
    v_i3_plus,
    v_i4_plus,
    v_marathon_20
  FROM public.participants p
  INNER JOIN public.missions s ON s.id = p.mission_id
  INNER JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
   AND psr.segment_index = s.segment_index
  WHERE p.user_id = v_uid
    AND psr.score_breakdown IS NOT NULL
    AND psr.updated_at >= v_week_start_ts
    AND psr.updated_at < v_week_end_ts;

  SELECT
    coalesce(sum(s.duration_minutes), 0)::int,
    coalesce(
      count(*) FILTER (
        WHERE coalesce(s.intensity_tier, 2) >= 3
      ),
      0
    )::int,
    coalesce(
      count(*) FILTER (
        WHERE coalesce(s.intensity_tier, 2) >= 4
      ),
      0
    )::int,
    coalesce(
      count(*) FILTER (WHERE s.duration_minutes = 20),
      0
    )::int
  INTO
    v_prev_minutes,
    v_prev_i3_plus,
    v_prev_i4_plus,
    v_prev_marathon_20
  FROM public.participants p
  INNER JOIN public.missions s ON s.id = p.mission_id
  INNER JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
   AND psr.segment_index = s.segment_index
  WHERE p.user_id = v_uid
    AND psr.score_breakdown IS NOT NULL
    AND psr.updated_at >= v_prev_week_start_ts
    AND psr.updated_at < v_prev_week_end_ts;

  -- Highest rank meeting all criteria wins. Special Ops is absolute.
  IF v_week_minutes >= 300 AND v_i4_plus >= 3 AND v_marathon_20 >= 1 THEN
    v_current_rank := 'special_ops';
  ELSIF v_week_minutes >= v_operator_minutes AND v_i3_plus >= v_operator_i3 THEN
    v_current_rank := 'operator';
  ELSIF v_week_minutes >= v_civilian_minutes THEN
    v_current_rank := 'civilian';
  ELSE
    v_current_rank := 'unclassified';
  END IF;

  IF v_prev_minutes >= 300 AND v_prev_i4_plus >= 3 AND v_prev_marathon_20 >= 1 THEN
    v_previous_rank := 'special_ops';
  ELSIF v_prev_minutes >= v_operator_minutes AND v_prev_i3_plus >= v_operator_i3 THEN
    v_previous_rank := 'operator';
  ELSIF v_prev_minutes >= v_civilian_minutes THEN
    v_previous_rank := 'civilian';
  ELSE
    v_previous_rank := 'unclassified';
  END IF;

  SELECT new_value
  INTO v_last_verified_rank
  FROM public.athlete_classification_history
  WHERE user_id = v_uid AND kind = 'verified'
  ORDER BY occurred_at DESC
  LIMIT 1;

  IF v_last_verified_rank IS DISTINCT FROM v_current_rank THEN
    INSERT INTO public.athlete_classification_history (user_id, kind, previous_value, new_value)
    VALUES (v_uid, 'verified', v_last_verified_rank, v_current_rank);
  END IF;

  SELECT max(psr.updated_at)
  INTO v_last_locked_at
  FROM public.participants p
  INNER JOIN public.missions s ON s.id = p.mission_id
  INNER JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
   AND psr.segment_index = s.segment_index
  WHERE p.user_id = v_uid
    AND psr.score_breakdown IS NOT NULL;

  -- attrition[0] = oldest (11 weeks ago); attrition[11] = current week
  WITH week_starts AS (
    SELECT
      gs AS week_index,
      (v_week_start_local - ((11 - gs) * 7)) AS week_start_local
    FROM generate_series(0, 11) AS gs
  ),
  week_bounds AS (
    SELECT
      week_index,
      week_start_local,
      (week_start_local::timestamp AT TIME ZONE p_timezone) AS week_start_ts,
      ((week_start_local + 7)::timestamp AT TIME ZONE p_timezone) AS week_end_ts
    FROM week_starts
  ),
  week_minutes AS (
    SELECT
      wb.week_index,
      coalesce(
        sum(s.duration_minutes) FILTER (WHERE psr.participant_id IS NOT NULL),
        0
      )::int AS minutes
    FROM week_bounds wb
    LEFT JOIN public.participants p
      ON p.user_id = v_uid
    LEFT JOIN public.missions s
      ON s.id = p.mission_id
    LEFT JOIN public.participant_segment_results psr
      ON psr.participant_id = p.id
     AND psr.segment_index = s.segment_index
     AND psr.score_breakdown IS NOT NULL
     AND psr.updated_at >= wb.week_start_ts
     AND psr.updated_at < wb.week_end_ts
    GROUP BY wb.week_index
  )
  SELECT coalesce(
    jsonb_agg((wm.minutes >= v_civilian_minutes) ORDER BY wm.week_index),
    '[]'::jsonb
  )
  INTO v_attrition
  FROM week_minutes wm;

  SELECT
    coalesce(sum(s.duration_minutes) FILTER (WHERE s.duration_minutes = 5), 0)::int,
    coalesce(sum(s.duration_minutes) FILTER (WHERE s.duration_minutes = 10), 0)::int,
    coalesce(sum(s.duration_minutes) FILTER (WHERE s.duration_minutes = 15), 0)::int,
    coalesce(sum(s.duration_minutes) FILTER (WHERE s.duration_minutes = 20), 0)::int,
    coalesce(
      sum(s.duration_minutes) FILTER (
        WHERE s.duration_minutes NOT IN (5, 10, 15, 20)
      ),
      0
    )::int
  INTO v_domain_5, v_domain_10, v_domain_15, v_domain_20, v_domain_other
  FROM public.participants p
  INNER JOIN public.missions s ON s.id = p.mission_id
  INNER JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
   AND psr.segment_index = s.segment_index
  WHERE p.user_id = v_uid
    AND psr.score_breakdown IS NOT NULL
    AND psr.updated_at >= now() - interval '30 days';

  RETURN jsonb_build_object(
    'ok', true,
    'telemetry', jsonb_build_object(
      'weekMinutes', v_week_minutes,
      'weekPviAverage',
        CASE
          WHEN v_week_pvi_average IS NULL THEN NULL
          ELSE round(v_week_pvi_average, 1)
        END,
      'weekEndsAt', to_jsonb(v_week_end_ts),
      'lastLockedAt', to_jsonb(v_last_locked_at),
      'attrition', v_attrition,
      'domainMinutes30d', jsonb_build_object(
        '5', v_domain_5,
        '10', v_domain_10,
        '15', v_domain_15,
        '20', v_domain_20,
        'other', v_domain_other
      ),
      'classification', jsonb_build_object(
        'current', v_current_rank,
        'previous', v_previous_rank,
        'progress', jsonb_build_object(
          'weekMinutes', v_week_minutes,
          'intensity3PlusCount', v_i3_plus,
          'intensity4PlusCount', v_i4_plus,
          'marathon20Count', v_marathon_20
        )
      ),
      'overtraining', public.compute_overtraining_load(v_uid, p_timezone)
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.join_rally_point(p_rally_point_id uuid, p_nickname text, p_rally_point_member_id uuid DEFAULT NULL::uuid, p_seat_claim text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_rally_point public.rally_points%ROWTYPE;
  v_nickname text;
  v_member_id uuid;
  v_existing_nickname text;
  v_member_count int;
  v_mission_id uuid;
  v_mission_state text;
  v_participant_id uuid;
  v_role text;
  v_claim_token text;
  v_claim_hash text;
  v_host_token text;
  v_part_count int;
  v_seat_claim text;
  v_seat_hash text;
  v_stored_hash text;
BEGIN
  v_uid := auth.uid();
  v_nickname := trim(p_nickname);
  IF v_nickname IS NULL OR v_nickname = '' OR length(v_nickname) > 50 THEN
    RAISE EXCEPTION 'Name or nickname is required (max 50 characters)';
  END IF;

  IF p_rally_point_id IS NULL THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  SELECT * INTO v_rally_point
  FROM public.rally_points
  WHERE id = p_rally_point_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  IF v_rally_point.status <> 'open' THEN
    RAISE EXCEPTION 'Rally point closed';
  END IF;

  v_seat_claim := NULL;

  -- Reclaim active membership for authenticated users.
  IF v_uid IS NOT NULL THEN
    SELECT id, nickname
    INTO v_member_id, v_existing_nickname
    FROM public.rally_point_members
    WHERE rally_point_id = p_rally_point_id
      AND user_id = v_uid
      AND status = 'active'
    ORDER BY joined_at ASC
    LIMIT 1;

    IF FOUND THEN
      -- Keep the roster nickname on reclaim; return that same value to the client.
      v_nickname := coalesce(nullif(v_existing_nickname, ''), v_nickname);
      UPDATE public.rally_point_members
      SET last_seen_at = now(), nickname = v_nickname
      WHERE id = v_member_id;
    ELSE
      -- Reactivate a prior left row when present.
      SELECT id INTO v_member_id
      FROM public.rally_point_members
      WHERE rally_point_id = p_rally_point_id
        AND user_id = v_uid
        AND status = 'left'
      ORDER BY joined_at DESC
      LIMIT 1;

      IF FOUND THEN
        UPDATE public.rally_point_members
        SET status = 'active',
            nickname = v_nickname,
            last_seen_at = now(),
            joined_at = now()
        WHERE id = v_member_id;
      ELSE
        SELECT count(*)::int INTO v_member_count
        FROM public.rally_point_members
        WHERE rally_point_id = p_rally_point_id AND status = 'active';

        IF v_member_count >= public.mission_participant_limit() THEN
          RAISE EXCEPTION 'Rally point is full';
        END IF;

        INSERT INTO public.rally_point_members (rally_point_id, user_id, nickname, status, last_seen_at)
        VALUES (p_rally_point_id, v_uid, v_nickname, 'active', now())
        RETURNING id INTO v_member_id;
      END IF;
    END IF;
  ELSE
    -- Guest seat ownership is a secret (seat_claim), not the public member id.
    -- Member ids appear in get_rally_point / Realtime for the roster; the claim does not.
    v_seat_claim := NULL;
    IF p_rally_point_member_id IS NOT NULL AND p_seat_claim IS NOT NULL AND length(trim(p_seat_claim)) > 0 THEN
      v_seat_hash := encode(digest(trim(p_seat_claim), 'sha256'), 'hex');

      SELECT id, claim_token_hash
      INTO v_member_id, v_stored_hash
      FROM public.rally_point_members
      WHERE id = p_rally_point_member_id
        AND rally_point_id = p_rally_point_id
        AND user_id IS NULL
        AND status = 'active'
      FOR UPDATE;

      IF FOUND AND v_stored_hash IS NOT NULL AND v_stored_hash = v_seat_hash THEN
        v_seat_claim :=
          replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
        v_seat_hash := encode(digest(v_seat_claim, 'sha256'), 'hex');

        UPDATE public.rally_point_members
        SET last_seen_at = now(),
            claim_token_hash = v_seat_hash
        WHERE id = v_member_id;
      ELSE
        v_member_id := NULL;
      END IF;
    END IF;

    IF v_member_id IS NULL THEN
      SELECT count(*)::int INTO v_member_count
      FROM public.rally_point_members
      WHERE rally_point_id = p_rally_point_id AND status = 'active';

      IF v_member_count >= public.mission_participant_limit() THEN
        RAISE EXCEPTION 'Rally point is full';
      END IF;

      v_seat_claim :=
        replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
      v_seat_hash := encode(digest(v_seat_claim, 'sha256'), 'hex');

      INSERT INTO public.rally_point_members
        (rally_point_id, user_id, nickname, status, last_seen_at, claim_token_hash)
      VALUES (p_rally_point_id, NULL, v_nickname, 'active', now(), v_seat_hash)
      RETURNING id INTO v_member_id;
    END IF;
  END IF;

  v_mission_id := v_rally_point.active_mission_id;
  v_participant_id := NULL;
  v_role := NULL;
  v_claim_token := NULL;
  v_host_token := NULL;
  v_mission_state := NULL;

  IF v_mission_id IS NOT NULL THEN
    SELECT state INTO v_mission_state
    FROM public.missions
    WHERE id = v_mission_id
    FOR UPDATE;

    IF FOUND THEN
      IF v_uid IS NOT NULL THEN
        SELECT p.id, p.role
        INTO v_participant_id, v_role
        FROM public.participants p
        WHERE p.mission_id = v_mission_id
          AND p.user_id = v_uid
        ORDER BY CASE WHEN p.role = 'host' THEN 0 ELSE 1 END, p.joined_at ASC
        LIMIT 1;

        IF FOUND THEN
          DELETE FROM public.participants
          WHERE mission_id = v_mission_id
            AND user_id = v_uid
            AND id <> v_participant_id;

          IF v_mission_state IN ('waiting', 'setup', 'work') THEN
            v_claim_token :=
              replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
            v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

            UPDATE public.participants
            SET claim_token_hash = v_claim_hash,
                nickname = coalesce(nullif(nickname, ''), v_nickname)
            WHERE id = v_participant_id;
          END IF;

          IF v_role = 'host' THEN
            SELECT host_token INTO v_host_token
            FROM public.missions
            WHERE id = v_mission_id;
          END IF;
        ELSIF v_mission_state = 'waiting' THEN
          SELECT count(*) INTO v_part_count
          FROM public.participants
          WHERE mission_id = v_mission_id;

          IF v_part_count >= public.mission_participant_limit() THEN
            RAISE EXCEPTION 'Mission is full';
          END IF;

          v_claim_token :=
            replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
          v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

          INSERT INTO public.participants
            (mission_id, nickname, role, claim_token_hash, user_id, rally_point_member_id)
          VALUES (v_mission_id, v_nickname, 'joiner', v_claim_hash, v_uid, v_member_id)
          RETURNING id INTO v_participant_id;

          v_role := 'joiner';
        END IF;
      ELSE
        -- start_next_rally_point_mission now seeds guests, so look for the seat this
        -- member already holds before making another one.
        SELECT p.id, p.role
        INTO v_participant_id, v_role
        FROM public.participants p
        WHERE p.mission_id = v_mission_id
          AND p.rally_point_member_id = v_member_id
        LIMIT 1;

        IF FOUND THEN
          IF v_mission_state IN ('waiting', 'setup', 'work') THEN
            v_claim_token :=
              replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
            v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

            UPDATE public.participants
            SET claim_token_hash = v_claim_hash,
                nickname = coalesce(nullif(nickname, ''), v_nickname)
            WHERE id = v_participant_id;
          END IF;
        ELSIF v_mission_state = 'waiting' THEN
          SELECT count(*) INTO v_part_count
          FROM public.participants
          WHERE mission_id = v_mission_id;

          IF v_part_count >= public.mission_participant_limit() THEN
            RAISE EXCEPTION 'Mission is full';
          END IF;

          v_claim_token :=
            replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
          v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

          INSERT INTO public.participants
            (mission_id, nickname, role, claim_token_hash, user_id, rally_point_member_id)
          VALUES (v_mission_id, v_nickname, 'joiner', v_claim_hash, NULL, v_member_id)
          RETURNING id INTO v_participant_id;

          v_role := 'joiner';
        END IF;
      END IF;
    ELSE
      v_mission_state := NULL;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'rally_point_id', p_rally_point_id,
    'rally_point_member_id', v_member_id,
    'host_user_id', v_rally_point.host_user_id,
    'status', v_rally_point.status,
    'active_mission_id', v_mission_id,
    'mission_id', v_mission_id,
    'mission_state', v_mission_state,
    'participant_id', v_participant_id,
    'nickname', v_nickname,
    'role', v_role,
    'claim_token', v_claim_token,
    'host_token', v_host_token,
    'seat_claim', v_seat_claim
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.join_mission(p_mission_id uuid, p_nickname text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_count int;
  v_participant_id uuid;
  v_nickname text;
  v_existing_nickname text;
  v_role text;
  v_claim_token text;
  v_claim_hash text;
  v_host_token text;
  v_state text;
BEGIN
  v_uid := auth.uid();
  v_nickname := trim(p_nickname);
  IF v_nickname IS NULL OR v_nickname = '' OR length(v_nickname) > 50 THEN
    RAISE EXCEPTION 'Name or nickname is required (max 50 characters)';
  END IF;

  IF p_mission_id IS NULL THEN
    RAISE EXCEPTION 'Mission not found';
  END IF;

  SELECT state
  INTO v_state
  FROM public.missions
  WHERE id = p_mission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission not found';
  END IF;

  -- Authenticated reclaim: return the existing row (prefer host) instead of
  -- inserting another joiner. Allowed in any mission state so the coach can
  -- reopen during setup/work after leaving the lobby.
  IF v_uid IS NOT NULL THEN
    SELECT p.id, p.nickname, p.role
    INTO v_participant_id, v_existing_nickname, v_role
    FROM public.participants p
    WHERE p.mission_id = p_mission_id
      AND p.user_id = v_uid
    ORDER BY CASE WHEN p.role = 'host' THEN 0 ELSE 1 END, p.joined_at ASC
    LIMIT 1;

    IF FOUND THEN
      -- Drop orphan joiner duplicates created by earlier unconditional joins.
      DELETE FROM public.participants
      WHERE mission_id = p_mission_id
        AND user_id = v_uid
        AND id <> v_participant_id;

      IF v_role = 'host' THEN
        SELECT s.host_token
        INTO v_host_token
        FROM public.missions s
        WHERE s.id = p_mission_id;
      END IF;

      RETURN jsonb_build_object(
        'participant_id', v_participant_id,
        'nickname', v_existing_nickname,
        'role', v_role,
        'claim_token', NULL,
        'host_token', v_host_token
      );
    END IF;
  END IF;

  IF v_state IS DISTINCT FROM 'waiting' THEN
    RAISE EXCEPTION 'Mission locked';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.participants
  WHERE mission_id = p_mission_id;

  IF v_count >= public.mission_participant_limit() THEN
    RAISE EXCEPTION 'Mission is full';
  END IF;

  v_claim_token :=
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

  INSERT INTO public.participants (mission_id, nickname, role, claim_token_hash, user_id)
  VALUES (p_mission_id, v_nickname, 'joiner', v_claim_hash, v_uid)
  RETURNING id INTO v_participant_id;

  RETURN jsonb_build_object(
    'participant_id', v_participant_id,
    'nickname', v_nickname,
    'role', 'joiner',
    'claim_token', v_claim_token,
    'host_token', NULL
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.leave_campaign(p_campaign_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_member public.campaign_members%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_member
  FROM public.campaign_members
  WHERE campaign_id = p_campaign_id AND user_id = v_uid AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  -- The host owns the campaign; leaving it would orphan everyone else's
  -- calendar. Ending the campaign is a different action.
  IF v_member.role = 'host' THEN
    RAISE EXCEPTION 'Host cannot leave';
  END IF;

  -- Kept as a row rather than deleted: the athlete's completed missions stay
  -- attributable, and re-joining restores their place.
  UPDATE public.campaign_members
  SET status = 'left'
  WHERE id = v_member.id;

  RETURN jsonb_build_object('ok', true, 'campaign_id', p_campaign_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.leave_rally_point(p_rally_point_id uuid, p_rally_point_member_id uuid DEFAULT NULL::uuid, p_seat_claim text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_rally_point public.rally_points%ROWTYPE;
  v_successor uuid;
  v_was_host boolean := false;
  v_updated int;
  v_seat_hash text;
BEGIN
  v_uid := auth.uid();

  IF p_rally_point_id IS NULL THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  SELECT * INTO v_rally_point
  FROM public.rally_points
  WHERE id = p_rally_point_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  IF v_uid IS NULL THEN
    IF p_rally_point_member_id IS NULL
       OR p_seat_claim IS NULL
       OR length(trim(p_seat_claim)) = 0
    THEN
      RAISE EXCEPTION 'Rally point not found';
    END IF;

    v_seat_hash := encode(digest(trim(p_seat_claim), 'sha256'), 'hex');

    UPDATE public.rally_point_members
    SET status = 'left'
    WHERE id = p_rally_point_member_id
      AND rally_point_id = p_rally_point_id
      AND user_id IS NULL
      AND status = 'active'
      AND claim_token_hash IS NOT NULL
      AND claim_token_hash = v_seat_hash;

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    RETURN jsonb_build_object(
      'ok', true,
      'rally_point_id', p_rally_point_id,
      'left', v_updated > 0
    );
  END IF;

  UPDATE public.rally_point_members
  SET status = 'left'
  WHERE rally_point_id = p_rally_point_id
    AND user_id = v_uid
    AND status = 'active';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', true, 'rally_point_id', p_rally_point_id, 'left', false);
  END IF;

  IF v_rally_point.host_user_id = v_uid AND v_rally_point.status = 'open' THEN
    v_was_host := true;
    v_successor := public._rally_point_pick_successor(p_rally_point_id, v_uid);

    IF v_successor IS NULL THEN
      UPDATE public.missions
      SET state = 'finished', is_paused = false, time_left_sec = 0
      WHERE rally_point_id = p_rally_point_id
        AND state IN ('waiting', 'setup');

      UPDATE public.rally_points
      SET status = 'closed',
          active_mission_id = NULL
      WHERE id = p_rally_point_id;

      UPDATE public.rally_point_members
      SET status = 'left'
      WHERE rally_point_id = p_rally_point_id
        AND status = 'active';

      RETURN jsonb_build_object(
        'ok', true,
        'rally_point_id', p_rally_point_id,
        'left', true,
        'closed', true
      );
    END IF;

    UPDATE public.rally_points
    SET host_user_id = v_successor
    WHERE id = p_rally_point_id;

    PERFORM public._rally_point_rotate_waiting_host(v_rally_point.active_mission_id, v_successor);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'rally_point_id', p_rally_point_id,
    'left', true,
    'was_host', v_was_host,
    'host_user_id', coalesce(v_successor, v_rally_point.host_user_id)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_round(p_mission_id uuid, p_participant_id uuid, p_claim_token text, p_round_index integer, p_elapsed_sec_at_round integer, p_segment_index integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_claim_token_hash text;
  v_participant_mission_id uuid;
  v_participant_user_id uuid;
  v_mission_state text;
  v_mission_segment_index int;
  v_duration_minutes int;
  v_max_work_sec int;
  v_round_count int;
  v_round_id uuid;
  v_hash text;
  v_uid uuid;
  v_authorized boolean := false;
BEGIN
  v_uid := auth.uid();

  IF p_mission_id IS NULL OR p_participant_id IS NULL OR p_claim_token IS NULL THEN
    RAISE EXCEPTION 'Invalid round log';
  END IF;

  IF p_round_index < 0 OR p_elapsed_sec_at_round < 0 OR p_segment_index < 0 THEN
    RAISE EXCEPTION 'Invalid round log';
  END IF;

  SELECT claim_token_hash, mission_id, user_id
  INTO v_claim_token_hash, v_participant_mission_id, v_participant_user_id
  FROM public.participants
  WHERE id = p_participant_id;

  IF NOT FOUND OR v_participant_mission_id <> p_mission_id THEN
    RAISE EXCEPTION 'Participant not found';
  END IF;

  IF v_claim_token_hash IS NOT NULL THEN
    v_hash := encode(digest(p_claim_token, 'sha256'), 'hex');
    IF v_hash = v_claim_token_hash THEN
      v_authorized := true;
    END IF;
  ELSIF v_uid IS NOT NULL
    AND v_participant_user_id IS NOT NULL
    AND v_participant_user_id = v_uid THEN
    v_authorized := true;
  END IF;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_claim_token');
  END IF;

  SELECT state, segment_index, duration_minutes
  INTO v_mission_state, v_mission_segment_index, v_duration_minutes
  FROM public.missions
  WHERE id = p_mission_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission not found';
  END IF;

  v_max_work_sec := v_duration_minutes * 60;

  IF p_elapsed_sec_at_round > v_max_work_sec THEN
    RAISE EXCEPTION 'Invalid round log';
  END IF;

  IF v_mission_state <> 'work' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'mission_not_in_work');
  END IF;

  IF p_segment_index <> v_mission_segment_index THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'stale_segment_index');
  END IF;

  SELECT count(*) INTO v_round_count
  FROM public.rounds
  WHERE participant_id = p_participant_id AND segment_index = p_segment_index;

  IF p_round_index <> v_round_count THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'round_index_mismatch');
  END IF;

  INSERT INTO public.rounds (
    mission_id,
    participant_id,
    round_index,
    elapsed_sec_at_round,
    segment_index
  )
  VALUES (
    p_mission_id,
    p_participant_id,
    p_round_index,
    p_elapsed_sec_at_round,
    p_segment_index
  )
  ON CONFLICT (participant_id, segment_index, round_index) DO NOTHING
  RETURNING id INTO v_round_id;

  IF v_round_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_round');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'round_id', v_round_id,
    'round_index', p_round_index,
    'elapsed_sec_at_round', p_elapsed_sec_at_round,
    'segment_index', p_segment_index
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.my_campaigns()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
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
      c.missions_per_week,
      c.start_date,
      c.timezone,
      c.status,
      c.created_at,
      m.role,
      CASE WHEN c.host_user_id = v_uid THEN c.invite_code ELSE NULL END AS invite_code,
      (
        SELECT count(*)::int FROM public.campaign_occurrences o
        WHERE o.campaign_id = c.id
      ) AS total_missions,
      (
        SELECT count(*)::int FROM public.campaign_occurrences o
        WHERE o.campaign_id = c.id AND o.status = 'done'
      ) AS completed_missions,
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
$function$;

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

CREATE OR REPLACE FUNCTION public.pass_rally_point_command(p_rally_point_id uuid, p_to_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_rally_point public.rally_points%ROWTYPE;
  v_mission_state text;
  v_target_nickname text;
  v_target_participant uuid;
  v_claim_token text;
  v_claim_hash text;
  v_rotated text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_rally_point_id IS NULL OR p_to_user_id IS NULL THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  SELECT * INTO v_rally_point
  FROM public.rally_points
  WHERE id = p_rally_point_id
  FOR UPDATE;

  IF NOT FOUND OR v_rally_point.status <> 'open' THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  IF v_rally_point.host_user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Only the host can pass command';
  END IF;

  -- Checked after authority, not before it: a demoted host passing to themselves
  -- was told "Cannot pass command to yourself" when the real answer is that they
  -- no longer hold command. Refused either way; the message was just wrong.
  IF p_to_user_id = v_uid THEN
    RAISE EXCEPTION 'Cannot pass command to yourself';
  END IF;

  SELECT nickname INTO v_target_nickname
  FROM public.rally_point_members
  WHERE rally_point_id = p_rally_point_id
    AND user_id = p_to_user_id
    AND status = 'active'
  LIMIT 1;

  IF v_target_nickname IS NULL THEN
    RAISE EXCEPTION 'Target is not an active crew member';
  END IF;

  IF v_rally_point.active_mission_id IS NOT NULL THEN
    SELECT state INTO v_mission_state
    FROM public.missions
    WHERE id = v_rally_point.active_mission_id
    FOR UPDATE;

    IF NOT FOUND THEN
      v_mission_state := NULL;
    ELSIF v_mission_state = 'work' THEN
      RAISE EXCEPTION 'Cannot pass command during a live mission';
    ELSIF v_mission_state IN ('waiting', 'setup') THEN
      SELECT id INTO v_target_participant
      FROM public.participants
      WHERE mission_id = v_rally_point.active_mission_id
        AND user_id = p_to_user_id
      ORDER BY joined_at ASC
      LIMIT 1;

      IF v_target_participant IS NULL THEN
        v_claim_token :=
          replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
        v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

        INSERT INTO public.participants (mission_id, nickname, role, claim_token_hash, user_id)
        VALUES (
          v_rally_point.active_mission_id,
          v_target_nickname,
          'joiner',
          v_claim_hash,
          p_to_user_id
        );
      END IF;

      UPDATE public.rally_points
      SET host_user_id = p_to_user_id
      WHERE id = p_rally_point_id;

      v_rotated := public._rally_point_rotate_waiting_host(v_rally_point.active_mission_id, p_to_user_id);
      IF v_rotated IS NULL THEN
        RAISE EXCEPTION 'Cannot pass command during a live mission';
      END IF;
    ELSIF v_mission_state = 'finished' THEN
      UPDATE public.rally_points
      SET host_user_id = p_to_user_id
      WHERE id = p_rally_point_id;
    ELSE
      RAISE EXCEPTION 'Cannot pass command during a live mission';
    END IF;
  ELSE
    UPDATE public.rally_points
    SET host_user_id = p_to_user_id
    WHERE id = p_rally_point_id;
  END IF;

  -- Never return the rotated token to the outgoing host.
  RETURN jsonb_build_object(
    'ok', true,
    'rally_point_id', p_rally_point_id,
    'host_user_id', p_to_user_id,
    'active_mission_id', v_rally_point.active_mission_id,
    'host_token', NULL
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.reschedule_campaign_occurrence(p_occurrence_id uuid, p_local_date date, p_local_time time without time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_occ public.campaign_occurrences%ROWTYPE;
  v_campaign public.campaigns%ROWTYPE;
  v_new timestamp;
  v_prev timestamp;
  v_next timestamp;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_local_date IS NULL OR p_local_time IS NULL THEN
    RAISE EXCEPTION 'Pick a date and a time';
  END IF;

  SELECT o.* INTO v_occ
  FROM public.campaign_occurrences o
  WHERE o.id = p_occurrence_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  SELECT * INTO v_campaign
  FROM public.campaigns
  WHERE id = v_occ.campaign_id
  FOR UPDATE;

  IF NOT FOUND OR v_campaign.host_user_id <> v_uid THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  IF v_campaign.status IN ('complete', 'abandoned') THEN
    RAISE EXCEPTION 'Campaign closed';
  END IF;

  -- Once a mission exists the staging area is open and people may be on their
  -- way to it, so the date stops being the host's to change.
  IF v_occ.status <> 'planned' OR v_occ.mission_id IS NOT NULL THEN
    RAISE EXCEPTION 'Mission already scheduled';
  END IF;

  v_new := (p_local_date::text || ' ' || p_local_time::text)::timestamp;

  IF (v_new AT TIME ZONE v_campaign.timezone) <= now() THEN
    RAISE EXCEPTION 'Pick a time in the future';
  END IF;

  -- The whole app reads a campaign in sequence order -- groupOccurrencesByWeek
  -- sorts on it, and deriveCampaignRoles reasons about position, not date. A
  -- mission that jumped over its neighbours would render out of order and make
  -- the schedule look broken, so a move has to stay inside its own slot.
  SELECT (o.local_date::text || ' ' || o.local_time::text)::timestamp
  INTO v_prev
  FROM public.campaign_occurrences o
  WHERE o.campaign_id = v_occ.campaign_id AND o.sequence < v_occ.sequence
  ORDER BY o.sequence DESC
  LIMIT 1;

  SELECT (o.local_date::text || ' ' || o.local_time::text)::timestamp
  INTO v_next
  FROM public.campaign_occurrences o
  WHERE o.campaign_id = v_occ.campaign_id AND o.sequence > v_occ.sequence
  ORDER BY o.sequence ASC
  LIMIT 1;

  IF v_prev IS NOT NULL AND v_new <= v_prev THEN
    RAISE EXCEPTION 'Move it after the mission before it';
  END IF;

  IF v_next IS NOT NULL AND v_new >= v_next THEN
    RAISE EXCEPTION 'Move it before the mission after it';
  END IF;

  -- Guarded in the statement as well: the cron generator does not lock the
  -- campaign row, and it inserts the mission and stamps the occurrence in one
  -- transaction, so re-checking at statement time sees both or neither rather
  -- than moving a mission someone is already waiting in.
  UPDATE public.campaign_occurrences
  SET local_date = p_local_date, local_time = p_local_time
  WHERE id = p_occurrence_id
    AND status = 'planned'
    AND mission_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission already scheduled';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'occurrence_id', p_occurrence_id,
    'local_date', p_local_date,
    'local_time', p_local_time
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.resume_mission_identity(p_mission_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_participant_id uuid;
  v_nickname text;
  v_role text;
  v_host_token text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_mission_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT p.id, p.nickname, p.role
  INTO v_participant_id, v_nickname, v_role
  FROM public.participants p
  WHERE p.mission_id = p_mission_id
    AND p.user_id = v_uid
  ORDER BY CASE WHEN p.role = 'host' THEN 0 ELSE 1 END, p.joined_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_claimed');
  END IF;

  -- Clean orphan joiner duplicates so the roster shows one row for this user.
  DELETE FROM public.participants
  WHERE mission_id = p_mission_id
    AND user_id = v_uid
    AND id <> v_participant_id;

  IF v_role = 'host' THEN
    SELECT s.host_token
    INTO v_host_token
    FROM public.missions s
    WHERE s.id = p_mission_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'participantId', v_participant_id,
    'nickname', v_nickname,
    'role', v_role,
    'hostToken', v_host_token
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.run_campaign_scheduler()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_occ RECORD;
  v_due timestamptz;
  v_mission_id uuid;
  v_host_nickname text;
  v_setup_sec int := 10;
BEGIN
  -- Generate planned occurrences that fall in the open window.
  -- Window is in SQL (not just the loop body) so each cron tick skips rows
  -- that are not due yet / already past the late bound.
  FOR v_occ IN
    SELECT
      o.id,
      o.workout,
      o.duration_minutes,
      o.template_id,
      o.intensity_tier,
      o.local_date,
      o.local_time,
      c.host_user_id,
      c.timezone,
      (
        (o.local_date::text || ' ' || o.local_time::text)::timestamp
        AT TIME ZONE c.timezone
      ) AS due_at
    FROM public.campaign_occurrences o
    INNER JOIN public.campaigns c ON c.id = o.campaign_id
    WHERE o.status = 'planned'
      AND o.mission_id IS NULL
      AND c.status = 'active'
      AND (
        (o.local_date::text || ' ' || o.local_time::text)::timestamp
        AT TIME ZONE c.timezone
      ) BETWEEN now() - interval '2 minutes' AND now() + interval '15 minutes'
  LOOP
    v_due := v_occ.due_at;

    v_host_nickname := coalesce(
      (SELECT nickname FROM public.athlete_profiles WHERE user_id = v_occ.host_user_id),
      'Host'
    );

    v_mission_id := NULL;

    INSERT INTO public.missions (
      host_token,
      duration_minutes,
      workout,
      template_id,
      intensity_tier,
      state,
      time_left_sec,
      scheduled_at,
      is_featured,
      campaign_occurrence_id
    )
    VALUES (
      gen_random_uuid()::text,
      v_occ.duration_minutes,
      v_occ.workout,
      v_occ.template_id,
      v_occ.intensity_tier,
      'waiting',
      v_setup_sec,
      v_due,
      false,
      v_occ.id
    )
    ON CONFLICT (campaign_occurrence_id) WHERE campaign_occurrence_id IS NOT NULL
    DO NOTHING
    RETURNING id INTO v_mission_id;

    IF v_mission_id IS NOT NULL THEN
      INSERT INTO public.participants (mission_id, nickname, role, user_id)
      VALUES (v_mission_id, v_host_nickname, 'host', v_occ.host_user_id);

      UPDATE public.campaign_occurrences
      SET mission_id = v_mission_id, status = 'generated'
      WHERE id = v_occ.id
        AND mission_id IS NULL
        AND status = 'planned';
    END IF;
  END LOOP;

  -- Past the late window with no mission → skipped (no backfill).
  UPDATE public.campaign_occurrences o
  SET status = 'skipped'
  FROM public.campaigns c
  WHERE o.campaign_id = c.id
    AND c.status = 'active'
    AND o.status = 'planned'
    AND o.mission_id IS NULL
    AND (
      (o.local_date::text || ' ' || o.local_time::text)::timestamp
      AT TIME ZONE c.timezone
    ) < now() - interval '2 minutes';

  -- Finish before classifying, so an occurrence reaches its terminal status on
  -- the same tick its mission ends rather than a minute later.
  --
  -- Finish work using the host Start anchor (started_at), not scheduled_at.
  UPDATE public.missions
  SET state = 'finished', is_paused = false, time_left_sec = 0
  WHERE campaign_occurrence_id IS NOT NULL
    AND state = 'work'
    AND started_at IS NOT NULL
    AND started_at + (duration_minutes * interval '1 minute') <= now();

  -- Abandoned waiting/setup long after the schedule window. Clearing
  -- started_at is what later marks the occurrence as never having run.
  UPDATE public.missions
  SET state = 'finished', is_paused = false, time_left_sec = 0, started_at = NULL
  WHERE campaign_occurrence_id IS NOT NULL
    AND state IN ('waiting', 'setup')
    AND scheduled_at IS NOT NULL
    AND scheduled_at
      + (v_setup_sec * interval '1 second')
      + (duration_minutes * interval '1 minute')
      + interval '30 minutes'
      <= now();

  -- Mission actually ran and ended → occurrence done.
  UPDATE public.campaign_occurrences o
  SET status = 'done'
  FROM public.missions s
  WHERE o.mission_id = s.id
    AND o.status = 'generated'
    AND s.state = 'finished'
    AND s.started_at IS NOT NULL;

  -- Mission was generated but the host never pressed Start → it did not
  -- happen, so it belongs with the other misses rather than counting as
  -- progress the crew never made.
  UPDATE public.campaign_occurrences o
  SET status = 'skipped'
  FROM public.missions s
  WHERE o.mission_id = s.id
    AND o.status = 'generated'
    AND s.state = 'finished'
    AND s.started_at IS NULL;

  -- Nothing left to run → the campaign is over. Frees one of the host's three
  -- campaign slots and stops the invite link admitting anyone else.
  UPDATE public.campaigns c
  SET status = 'complete', updated_at = now()
  WHERE c.status = 'active'
    AND EXISTS (SELECT 1 FROM public.campaign_occurrences o WHERE o.campaign_id = c.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.campaign_occurrences o
      WHERE o.campaign_id = c.id
        AND o.status IN ('planned', 'generated')
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.run_featured_wod_scheduler()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_schedule RECORD;
  v_workout RECORD;
  v_day date;
  v_dow int;
  v_time text;
  v_scheduled_at timestamptz;
  v_mission_id uuid;
  v_host_nickname text;
  v_workout_json jsonb;
  v_setup_sec int := 10;
  i int;
BEGIN
  FOR v_schedule IN
    SELECT * FROM public.featured_wod_schedules WHERE active = true
  LOOP
    SELECT * INTO v_workout
    FROM public.coach_workouts
    WHERE id = v_schedule.coach_workout_id AND status = 'published';

    IF NOT FOUND THEN
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

    FOR i IN 0..7 LOOP
      v_day := (now() AT TIME ZONE v_schedule.timezone)::date + i;
      v_dow := EXTRACT(DOW FROM v_day)::int;

      IF NOT (v_dow = ANY (v_schedule.days_of_week)) THEN
        CONTINUE;
      END IF;

      FOREACH v_time IN ARRAY v_schedule.times_local LOOP
        v_scheduled_at := (v_day::text || ' ' || v_time)::timestamp AT TIME ZONE v_schedule.timezone;

        IF v_scheduled_at < now() - interval '2 minutes' THEN
          CONTINUE;
        END IF;

        v_mission_id := NULL;

        INSERT INTO public.missions (
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
          v_setup_sec,
          v_scheduled_at,
          true,
          v_schedule.id
        )
        ON CONFLICT (featured_schedule_id, scheduled_at) WHERE featured_schedule_id IS NOT NULL
        DO NOTHING
        RETURNING id INTO v_mission_id;

        IF v_mission_id IS NOT NULL THEN
          INSERT INTO public.participants (mission_id, nickname, role, user_id)
          VALUES (v_mission_id, v_host_nickname, 'host', v_schedule.created_by);
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Finish work using the host Start anchor (started_at), not scheduled_at.
  UPDATE public.missions
  SET state = 'finished', is_paused = false, time_left_sec = 0
  WHERE is_featured = true
    AND state = 'work'
    AND started_at IS NOT NULL
    AND started_at + (duration_minutes * interval '1 minute') <= now();

  -- Abandoned waiting/setup long after the schedule window.
  UPDATE public.missions
  SET state = 'finished', is_paused = false, time_left_sec = 0, started_at = NULL
  WHERE is_featured = true
    AND state IN ('waiting', 'setup')
    AND scheduled_at IS NOT NULL
    AND scheduled_at
      + (v_setup_sec * interval '1 second')
      + (duration_minutes * interval '1 minute')
      + interval '30 minutes'
      <= now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.send_message(p_mission_id uuid, p_participant_id uuid, p_claim_token text, p_body text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_claim_token_hash text;
  v_participant_mission_id uuid;
  v_participant_user_id uuid;
  v_participant_nickname text;
  v_mission_segment_index int;
  v_body text;
  v_hash text;
  v_uid uuid;
  v_authorized boolean := false;
  v_message_id uuid;
  v_created_at timestamptz;
BEGIN
  v_uid := auth.uid();

  IF p_mission_id IS NULL OR p_participant_id IS NULL OR p_claim_token IS NULL THEN
    RAISE EXCEPTION 'Invalid message';
  END IF;

  IF p_body IS NULL THEN
    RAISE EXCEPTION 'Invalid message';
  END IF;

  v_body := btrim(p_body, E' \t\n\r');

  IF v_body = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'empty_body');
  END IF;

  IF length(v_body) > 500 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'body_too_long');
  END IF;

  SELECT claim_token_hash, mission_id, user_id, nickname
  INTO v_claim_token_hash, v_participant_mission_id, v_participant_user_id, v_participant_nickname
  FROM public.participants
  WHERE id = p_participant_id;

  IF NOT FOUND OR v_participant_mission_id <> p_mission_id THEN
    RAISE EXCEPTION 'Participant not found';
  END IF;

  IF v_claim_token_hash IS NOT NULL THEN
    v_hash := encode(digest(p_claim_token, 'sha256'), 'hex');
    IF v_hash = v_claim_token_hash THEN
      v_authorized := true;
    END IF;
  ELSIF v_uid IS NOT NULL
    AND v_participant_user_id IS NOT NULL
    AND v_participant_user_id = v_uid THEN
    v_authorized := true;
  END IF;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_claim_token');
  END IF;

  SELECT segment_index
  INTO v_mission_segment_index
  FROM public.missions
  WHERE id = p_mission_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission not found';
  END IF;

  INSERT INTO public.messages (
    mission_id,
    participant_id,
    nickname,
    body,
    segment_index
  )
  VALUES (
    p_mission_id,
    p_participant_id,
    v_participant_nickname,
    v_body,
    v_mission_segment_index
  )
  RETURNING id, created_at INTO v_message_id, v_created_at;

  RETURN jsonb_build_object(
    'ok', true,
    'message_id', v_message_id,
    'mission_id', p_mission_id,
    'participant_id', p_participant_id,
    'nickname', v_participant_nickname,
    'body', v_body,
    'segment_index', v_mission_segment_index,
    'created_at', v_created_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mission_participant_limit()
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$ SELECT 100 $function$;

CREATE OR REPLACE FUNCTION public.set_rally_point_countdown(p_mission_id uuid, p_host_token text, p_seconds integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_host_token text;
  v_state text;
  v_ends_at timestamptz;
BEGIN
  IF p_mission_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT host_token, state
  INTO v_host_token, v_state
  FROM public.missions
  WHERE id = p_mission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF p_host_token IS NULL OR p_host_token <> v_host_token THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_host_token');
  END IF;

  IF v_state <> 'waiting' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'mission_not_waiting');
  END IF;

  IF p_seconds IS NULL OR p_seconds <= 0 OR p_seconds > 600 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_seconds');
  END IF;

  v_ends_at := now() + (p_seconds * interval '1 second');

  UPDATE public.missions
  SET rally_point_countdown_ends_at = v_ends_at
  WHERE id = p_mission_id AND host_token = p_host_token;

  RETURN jsonb_build_object(
    'ok', true,
    'rally_point_countdown_ends_at', v_ends_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.start_assigned_workout(p_assigned_workout_id uuid, p_mission_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_updated int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- The mission has to be one the caller is actually in, so an assignment
  -- cannot be marked started against someone else's mission.
  IF NOT EXISTS (
    SELECT 1 FROM public.participants
    WHERE mission_id = p_mission_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'That workout is not available';
  END IF;

  UPDATE public.assigned_workouts
  SET status = 'started', mission_id = p_mission_id, resolved_at = now()
  WHERE id = p_assigned_workout_id
    AND to_user_id = v_uid
    AND status = 'pending';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'That workout is not available';
  END IF;

  RETURN jsonb_build_object('ok', true, 'assigned_workout_id', p_assigned_workout_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.start_campaign_makeup(p_occurrence_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
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

  -- Default pacer: best scored crewmate on the live occurrence mission.
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
$function$;

CREATE OR REPLACE FUNCTION public.start_next_rally_point_mission(p_rally_point_id uuid, p_duration_minutes integer, p_workout jsonb, p_template_id text, p_intensity_tier integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_rally_point public.rally_points%ROWTYPE;
  v_prior_state text;
  v_mission_id uuid;
  v_host_token text;
  v_participant_id uuid;
  v_host_claim_token text;
  v_template_id text;
  v_intensity_tier int;
  v_active int;
  v_member record;
  v_role text;
  v_claim_token text;
  v_claim_hash text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_rally_point_id IS NULL THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  SELECT * INTO v_rally_point
  FROM public.rally_points
  WHERE id = p_rally_point_id
  FOR UPDATE;

  IF NOT FOUND OR v_rally_point.status <> 'open' THEN
    RAISE EXCEPTION 'Rally point not found';
  END IF;

  IF v_rally_point.host_user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Only the host can start the next mission';
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

  IF v_rally_point.active_mission_id IS NOT NULL THEN
    SELECT state INTO v_prior_state
    FROM public.missions
    WHERE id = v_rally_point.active_mission_id
    FOR UPDATE;

    IF FOUND AND v_prior_state IS DISTINCT FROM 'finished' THEN
      RAISE EXCEPTION 'Current mission is still active';
    END IF;
  END IF;

  SELECT host_user_id INTO v_rally_point.host_user_id
  FROM public.rally_points
  WHERE id = p_rally_point_id;

  IF v_rally_point.host_user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Only the host can start the next mission';
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
    )
    AND (
      s.rally_point_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.rally_points l
        WHERE l.id = s.rally_point_id
          AND l.status = 'open'
      )
    );

  IF v_active >= 3 THEN
    RAISE EXCEPTION 'Host mission limit reached';
  END IF;

  v_host_token := gen_random_uuid()::text;

  INSERT INTO public.missions (
    host_token,
    duration_minutes,
    workout,
    template_id,
    intensity_tier,
    state,
    time_left_sec,
    rally_point_id
  )
  VALUES (
    v_host_token,
    p_duration_minutes,
    p_workout,
    v_template_id,
    v_intensity_tier,
    'waiting',
    10,
    p_rally_point_id
  )
  RETURNING id INTO v_mission_id;

  UPDATE public.rally_points
  SET active_mission_id = v_mission_id,
      next_mission_pending_at = NULL
  WHERE id = p_rally_point_id;

  v_participant_id := NULL;
  v_host_claim_token := NULL;
  FOR v_member IN
    SELECT *
    FROM public.rally_point_members
    WHERE rally_point_id = p_rally_point_id
      AND status = 'active'
    ORDER BY joined_at ASC
  LOOP
    v_role := CASE
      WHEN v_member.user_id IS NOT NULL AND v_member.user_id = v_uid THEN 'host'
      ELSE 'joiner'
    END;

    v_claim_token :=
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

    INSERT INTO public.participants
      (mission_id, nickname, role, claim_token_hash, user_id, rally_point_member_id)
    VALUES (v_mission_id, v_member.nickname, v_role, v_claim_hash, v_member.user_id, v_member.id);

    IF v_role = 'host' THEN
      v_host_claim_token := v_claim_token;
      SELECT id INTO v_participant_id
      FROM public.participants
      WHERE mission_id = v_mission_id
        AND user_id = v_uid
        AND role = 'host'
      LIMIT 1;
    END IF;
  END LOOP;

  IF v_participant_id IS NULL THEN
    SELECT id INTO v_participant_id
    FROM public.participants
    WHERE mission_id = v_mission_id
      AND user_id = v_uid
      AND role = 'host'
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'rally_point_id', p_rally_point_id,
    'mission_id', v_mission_id,
    'host_token', v_host_token,
    'participant_id', v_participant_id,
    'claim_token', v_host_claim_token
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_participant_result(p_mission_id uuid, p_participant_id uuid, p_claim_token text, p_partial_reps integer, p_segment_index integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
BEGIN
  RETURN jsonb_build_object('ok', false, 'reason', 'use_edge_function');
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_mission_scheduled_at(p_mission_id uuid, p_scheduled_at timestamp with time zone, p_timezone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_state text;
  v_existing_scheduled_at timestamptz;
  v_timezone text;
  v_today date;
  v_rally_date date;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_mission_id IS NULL THEN
    RAISE EXCEPTION 'Mission id is required';
  END IF;

  IF p_scheduled_at IS NULL THEN
    RAISE EXCEPTION 'Rally time is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.participants p
    WHERE p.mission_id = p_mission_id
      AND p.user_id = v_uid
      AND p.role = 'host'
  ) THEN
    RAISE EXCEPTION 'Only the host can update rally time';
  END IF;

  SELECT s.state, s.scheduled_at
  INTO v_state, v_existing_scheduled_at
  FROM public.missions s
  WHERE s.id = p_mission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission not found';
  END IF;

  IF v_existing_scheduled_at IS NULL THEN
    RAISE EXCEPTION 'Mission has no scheduled rally time';
  END IF;

  IF v_state <> 'waiting' THEN
    RAISE EXCEPTION 'Mission is not waiting';
  END IF;

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

  UPDATE public.missions
  SET scheduled_at = p_scheduled_at,
      rally_point_countdown_ends_at = NULL
  WHERE id = p_mission_id;

  RETURN jsonb_build_object(
    'ok', true,
    'scheduled_at', p_scheduled_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_mission_state(p_mission_id uuid, p_host_token text, p_state text, p_time_left_sec integer, p_is_paused boolean, p_started_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_host_token text;
  v_duration_minutes int;
  v_max_work_sec int;
  v_effective_paused boolean;
BEGIN
  IF p_mission_id IS NULL THEN
    RAISE EXCEPTION 'Mission not found';
  END IF;

  SELECT host_token, duration_minutes
  INTO v_host_token, v_duration_minutes
  FROM public.missions
  WHERE id = p_mission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission not found';
  END IF;

  IF p_host_token IS NULL OR p_host_token <> v_host_token THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_host_token');
  END IF;

  IF p_state NOT IN ('waiting', 'setup', 'work', 'finished') THEN
    RAISE EXCEPTION 'Invalid mission state';
  END IF;

  IF p_time_left_sec IS NULL OR p_time_left_sec < 0 THEN
    RAISE EXCEPTION 'Invalid time_left_sec';
  END IF;

  v_max_work_sec := v_duration_minutes * 60;

  IF p_state = 'work' AND p_time_left_sec > v_max_work_sec THEN
    RAISE EXCEPTION 'Invalid time_left_sec';
  END IF;

  IF p_state = 'setup' AND p_time_left_sec > 60 THEN
    RAISE EXCEPTION 'Invalid time_left_sec';
  END IF;

  v_effective_paused := p_state = 'work' AND p_is_paused;

  UPDATE public.missions
  SET
    state = p_state,
    time_left_sec = p_time_left_sec,
    is_paused = v_effective_paused,
    started_at = CASE
      WHEN p_state = 'work' AND p_started_at IS NOT NULL THEN p_started_at
      WHEN p_state = 'work' THEN started_at
      ELSE NULL
    END
  WHERE id = p_mission_id AND host_token = p_host_token;

  RETURN jsonb_build_object(
    'ok', true,
    'mission_id', p_mission_id,
    'state', p_state,
    'time_left_sec', p_time_left_sec,
    'is_paused', v_effective_paused,
    'started_at', CASE
      WHEN p_state = 'work' AND p_started_at IS NOT NULL THEN p_started_at
      WHEN p_state = 'work' THEN (
        SELECT started_at FROM public.missions WHERE id = p_mission_id
      )
      ELSE NULL
    END,
    'segment_index', (
      SELECT segment_index FROM public.missions WHERE id = p_mission_id
    )
  );
END;
$function$;

-- 6. Grants, matching what each function held before the rename.
REVOKE EXECUTE ON FUNCTION public._rally_point_rotate_waiting_host(p_mission_id uuid, p_new_host_user_id uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.announce_next_mission(p_rally_point_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.announce_next_mission(p_rally_point_id uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.available_ghosts(p_template_id text, p_duration_minutes integer, p_for_mission_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.available_ghosts(p_template_id text, p_duration_minutes integer, p_for_mission_id uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.campaign_detail(p_campaign_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.campaign_detail(p_campaign_id uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.campaign_invite_preview(p_invite_code text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.campaign_invite_preview(p_invite_code text) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.campaign_standings(p_campaign_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.campaign_standings(p_campaign_id uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_rally_point_countdown(p_mission_id uuid, p_host_token text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_rally_point_countdown(p_mission_id uuid, p_host_token text) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_participant(p_participant_id uuid, p_claim_token text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_participant(p_participant_id uuid, p_claim_token text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_rally_point_command_if_stale(p_rally_point_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_rally_point_command_if_stale(p_rally_point_id uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.close_rally_point(p_rally_point_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_rally_point(p_rally_point_id uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.coach_dashboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_dashboard() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.coach_events_recent(p_event_name text, p_limit integer, p_user_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_events_recent(p_event_name text, p_limit integer, p_user_id uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.coach_featured_wod_attendees() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_featured_wod_attendees() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.coach_set_featured_schedule(p_coach_workout_id uuid, p_days_of_week integer[], p_times_local text[], p_timezone text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_set_featured_schedule(p_coach_workout_id uuid, p_days_of_week integer[], p_times_local text[], p_timezone text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.coach_upsert_workout(p_id uuid, p_name text, p_focus text, p_duration_minutes integer, p_intensity_tier integer, p_movements jsonb, p_tags text[], p_notes text, p_is_shared boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_upsert_workout(p_id uuid, p_name text, p_focus text, p_duration_minutes integer, p_intensity_tier integer, p_movements jsonb, p_tags text[], p_notes text, p_is_shared boolean) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.coach_user_detail(p_user_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_user_detail(p_user_id uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.coach_users_list(p_search text, p_limit integer, p_activity_bucket text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_users_list(p_search text, p_limit integer, p_activity_bucket text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.coach_workout_history(p_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_workout_history(p_id uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.coach_workout_is_locked(p_workout_id uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_overtraining_load(p_user_id uuid, p_timezone text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_campaign(p_name text, p_goal text, p_week_count integer, p_start_date date, p_timezone text, p_occurrences jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_campaign(p_name text, p_goal text, p_week_count integer, p_start_date date, p_timezone text, p_occurrences jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_rally_point_mission(p_duration_minutes integer, p_nickname text, p_workout jsonb, p_template_id text, p_intensity_tier integer, p_scheduled_at timestamp with time zone, p_timezone text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_rally_point_mission(p_duration_minutes integer, p_nickname text, p_workout jsonb, p_template_id text, p_intensity_tier integer, p_scheduled_at timestamp with time zone, p_timezone text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_mission(p_duration_minutes integer, p_nickname text, p_workout jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_mission(p_duration_minutes integer, p_nickname text, p_workout jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_mission(p_duration_minutes integer, p_nickname text, p_workout jsonb, p_template_id text, p_intensity_tier integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_mission(p_duration_minutes integer, p_nickname text, p_workout jsonb, p_template_id text, p_intensity_tier integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_mission(p_duration_minutes integer, p_nickname text, p_workout jsonb, p_template_id text, p_intensity_tier integer, p_scheduled_at timestamp with time zone, p_timezone text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_mission(p_duration_minutes integer, p_nickname text, p_workout jsonb, p_template_id text, p_intensity_tier integer, p_scheduled_at timestamp with time zone, p_timezone text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.current_featured_wod() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_featured_wod() TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_campaign(p_campaign_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_campaign(p_campaign_id uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_incomplete_mission(p_mission_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_incomplete_mission(p_mission_id uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.end_campaign(p_campaign_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.end_campaign(p_campaign_id uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.featured_wod_next_occurrence(p_schedule featured_wod_schedules) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_rally_point(p_rally_point_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_rally_point(p_rally_point_id uuid) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ghost_curve_data(p_mission_id uuid, p_participant_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ghost_curve_data(p_mission_id uuid, p_participant_id uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.host_active_mission_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.host_active_mission_count() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.host_scheduled_missions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.host_scheduled_missions() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.hud_telemetry(p_timezone text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hud_telemetry(p_timezone text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.join_rally_point(p_rally_point_id uuid, p_nickname text, p_rally_point_member_id uuid, p_seat_claim text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_rally_point(p_rally_point_id uuid, p_nickname text, p_rally_point_member_id uuid, p_seat_claim text) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.join_mission(p_mission_id uuid, p_nickname text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_mission(p_mission_id uuid, p_nickname text) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.leave_campaign(p_campaign_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_campaign(p_campaign_id uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.leave_rally_point(p_rally_point_id uuid, p_rally_point_member_id uuid, p_seat_claim text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_rally_point(p_rally_point_id uuid, p_rally_point_member_id uuid, p_seat_claim text) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_round(p_mission_id uuid, p_participant_id uuid, p_claim_token text, p_round_index integer, p_elapsed_sec_at_round integer, p_segment_index integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_round(p_mission_id uuid, p_participant_id uuid, p_claim_token text, p_round_index integer, p_elapsed_sec_at_round integer, p_segment_index integer) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.my_campaigns() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_campaigns() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.my_missions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_missions() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.pass_rally_point_command(p_rally_point_id uuid, p_to_user_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pass_rally_point_command(p_rally_point_id uuid, p_to_user_id uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.reschedule_campaign_occurrence(p_occurrence_id uuid, p_local_date date, p_local_time time without time zone) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reschedule_campaign_occurrence(p_occurrence_id uuid, p_local_date date, p_local_time time without time zone) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.resume_mission_identity(p_mission_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resume_mission_identity(p_mission_id uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.run_campaign_scheduler() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_featured_wod_scheduler() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_message(p_mission_id uuid, p_participant_id uuid, p_claim_token text, p_body text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_message(p_mission_id uuid, p_participant_id uuid, p_claim_token text, p_body text) TO anon, authenticated;
-- public.mission_participant_limit() had no explicit ACL; it keeps the default.
REVOKE EXECUTE ON FUNCTION public.set_rally_point_countdown(p_mission_id uuid, p_host_token text, p_seconds integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_rally_point_countdown(p_mission_id uuid, p_host_token text, p_seconds integer) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.start_assigned_workout(p_assigned_workout_id uuid, p_mission_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_assigned_workout(p_assigned_workout_id uuid, p_mission_id uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.start_campaign_makeup(p_occurrence_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_campaign_makeup(p_occurrence_id uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.start_next_rally_point_mission(p_rally_point_id uuid, p_duration_minutes integer, p_workout jsonb, p_template_id text, p_intensity_tier integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_next_rally_point_mission(p_rally_point_id uuid, p_duration_minutes integer, p_workout jsonb, p_template_id text, p_intensity_tier integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_participant_result(p_mission_id uuid, p_participant_id uuid, p_claim_token text, p_partial_reps integer, p_segment_index integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_participant_result(p_mission_id uuid, p_participant_id uuid, p_claim_token text, p_partial_reps integer, p_segment_index integer) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_mission_scheduled_at(p_mission_id uuid, p_scheduled_at timestamp with time zone, p_timezone text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_mission_scheduled_at(p_mission_id uuid, p_scheduled_at timestamp with time zone, p_timezone text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_mission_state(p_mission_id uuid, p_host_token text, p_state text, p_time_left_sec integer, p_is_paused boolean, p_started_at timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_mission_state(p_mission_id uuid, p_host_token text, p_state text, p_time_left_sec integer, p_is_paused boolean, p_started_at timestamp with time zone) TO anon, authenticated;
