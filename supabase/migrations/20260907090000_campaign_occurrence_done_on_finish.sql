-- Preserve started_at when a mission finishes, and classify campaign
-- occurrences as done when there is evidence the crew actually trained.
--
-- Bug: update_mission_state cleared started_at on every non-work transition,
-- including finished. run_campaign_scheduler then treated finished + null
-- started_at as "never started" → skipped. Completed campaign missions
-- (scores in My missions) showed as Skipped on the schedule and dropped out
-- of progress / standings.

CREATE OR REPLACE FUNCTION public.mission_has_campaign_work_evidence(p_mission_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT
    p_mission_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.rounds r
        WHERE r.mission_id = p_mission_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.participants part
        INNER JOIN public.participant_segment_results psr
          ON psr.participant_id = part.id
         AND psr.final_score IS NOT NULL
        WHERE part.mission_id = p_mission_id
      )
    );
$$;

REVOKE EXECUTE ON FUNCTION public.mission_has_campaign_work_evidence(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mission_has_campaign_work_evidence(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.update_mission_state(
  p_mission_id uuid,
  p_host_token text,
  p_state text,
  p_time_left_sec integer,
  p_is_paused boolean,
  p_started_at timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_host_token text;
  v_duration_minutes int;
  v_max_work_sec int;
  v_effective_paused boolean;
  v_started_at timestamptz;
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

  -- Keep started_at through finished so campaign classification still sees
  -- that the host pressed Start. waiting/setup clear it (reset / abandon).
  UPDATE public.missions
  SET
    state = p_state,
    time_left_sec = p_time_left_sec,
    is_paused = v_effective_paused,
    started_at = CASE
      WHEN p_state = 'work' AND p_started_at IS NOT NULL THEN p_started_at
      WHEN p_state = 'work' THEN started_at
      WHEN p_state = 'finished' THEN started_at
      ELSE NULL
    END
  WHERE id = p_mission_id AND host_token = p_host_token
  RETURNING started_at INTO v_started_at;

  RETURN jsonb_build_object(
    'ok', true,
    'mission_id', p_mission_id,
    'state', p_state,
    'time_left_sec', p_time_left_sec,
    'is_paused', v_effective_paused,
    'started_at', v_started_at,
    'segment_index', (
      SELECT segment_index FROM public.missions WHERE id = p_mission_id
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_mission_state(
  uuid, text, text, integer, boolean, timestamp with time zone
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_mission_state(
  uuid, text, text, integer, boolean, timestamp with time zone
) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.run_campaign_scheduler()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_occ RECORD;
  v_due timestamptz;
  v_mission_id uuid;
  v_host_nickname text;
  v_setup_sec int := 10;
BEGIN
  -- Generate planned occurrences that fall in the open window.
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

  -- Mission actually ran → done. Prefer started_at; also accept rounds or
  -- scored results so host-finished missions that lost started_at still count.
  UPDATE public.campaign_occurrences o
  SET status = 'done'
  FROM public.missions s
  WHERE o.mission_id = s.id
    AND o.status = 'generated'
    AND s.state = 'finished'
    AND (
      s.started_at IS NOT NULL
      OR public.mission_has_campaign_work_evidence(s.id)
    );

  -- Generated but never started and no work evidence → skipped.
  UPDATE public.campaign_occurrences o
  SET status = 'skipped'
  FROM public.missions s
  WHERE o.mission_id = s.id
    AND o.status = 'generated'
    AND s.state = 'finished'
    AND s.started_at IS NULL
    AND NOT public.mission_has_campaign_work_evidence(s.id);

  -- Repair rows already misclassified as skipped after a real finish.
  UPDATE public.campaign_occurrences o
  SET status = 'done'
  FROM public.missions s
  WHERE o.mission_id = s.id
    AND o.status = 'skipped'
    AND s.state = 'finished'
    AND (
      s.started_at IS NOT NULL
      OR public.mission_has_campaign_work_evidence(s.id)
    );

  -- Nothing left to run → the campaign is over.
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
$$;

REVOKE EXECUTE ON FUNCTION public.run_campaign_scheduler() FROM PUBLIC, anon, authenticated;

-- One-shot repair for already-misclassified completions (same rule as above).
UPDATE public.campaign_occurrences o
SET status = 'done'
FROM public.missions s
WHERE o.mission_id = s.id
  AND o.status = 'skipped'
  AND s.state = 'finished'
  AND (
    s.started_at IS NOT NULL
    OR public.mission_has_campaign_work_evidence(s.id)
  );
