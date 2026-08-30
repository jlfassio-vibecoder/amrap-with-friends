-- Campaign session generator + standings RPC.
-- Modelled on run_featured_wod_scheduler (manual-start): materialise ~15 min
-- early / ≤2 min late, stay waiting until the host presses Start, skip gaps,
-- finish work from started_at, and force-finish abandoned waiting/setup rows.

CREATE OR REPLACE FUNCTION public.run_campaign_scheduler()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_occ RECORD;
  v_due timestamptz;
  v_session_id uuid;
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
      AND o.session_id IS NULL
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

    v_session_id := NULL;

    INSERT INTO public.sessions (
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
    RETURNING id INTO v_session_id;

    IF v_session_id IS NOT NULL THEN
      INSERT INTO public.participants (session_id, nickname, role, user_id)
      VALUES (v_session_id, v_host_nickname, 'host', v_occ.host_user_id);

      UPDATE public.campaign_occurrences
      SET session_id = v_session_id, status = 'generated'
      WHERE id = v_occ.id
        AND session_id IS NULL
        AND status = 'planned';
    END IF;
  END LOOP;

  -- Past the late window with no session → skipped (no backfill).
  UPDATE public.campaign_occurrences o
  SET status = 'skipped'
  FROM public.campaigns c
  WHERE o.campaign_id = c.id
    AND c.status = 'active'
    AND o.status = 'planned'
    AND o.session_id IS NULL
    AND (
      (o.local_date::text || ' ' || o.local_time::text)::timestamp
      AT TIME ZONE c.timezone
    ) < now() - interval '2 minutes';

  -- Linked session finished → occurrence done.
  UPDATE public.campaign_occurrences o
  SET status = 'done'
  FROM public.sessions s
  WHERE o.session_id = s.id
    AND o.status = 'generated'
    AND s.state = 'finished';

  -- Finish work using the host Start anchor (started_at), not scheduled_at.
  UPDATE public.sessions
  SET state = 'finished', is_paused = false, time_left_sec = 0
  WHERE campaign_occurrence_id IS NOT NULL
    AND state = 'work'
    AND started_at IS NOT NULL
    AND started_at + (duration_minutes * interval '1 minute') <= now();

  -- Abandoned waiting/setup long after the schedule window.
  UPDATE public.sessions
  SET state = 'finished', is_paused = false, time_left_sec = 0, started_at = NULL
  WHERE campaign_occurrence_id IS NOT NULL
    AND state IN ('waiting', 'setup')
    AND scheduled_at IS NOT NULL
    AND scheduled_at
      + (v_setup_sec * interval '1 second')
      + (duration_minutes * interval '1 minute')
      + interval '30 minutes'
      <= now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.run_campaign_scheduler() FROM PUBLIC, anon, authenticated;

-- Wire the per-minute cron tick when pg_cron is available (hosted Supabase).
-- Guarded so local/CI Postgres without the extension can still replay.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron';
    PERFORM cron.schedule(
      'campaign-scheduler',
      '* * * * *',
      'SELECT public.run_campaign_scheduler();'
    );
  END IF;
END;
$$;

-- Standings payload for the client pure aggregator (computeCampaignStandings).
-- Active members only; non-members get the same "not found" as campaign_detail.
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

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'occurrence_id', o.id,
        'user_id', part.user_id,
        'final_score', psr.final_score
      )
    ),
    '[]'::jsonb
  )
  INTO v_scores
  FROM public.campaign_occurrences o
  INNER JOIN public.sessions s ON s.id = o.session_id
  INNER JOIN public.participants part
    ON part.session_id = s.id AND part.user_id IS NOT NULL
  LEFT JOIN public.participant_segment_results psr
    ON psr.participant_id = part.id
   AND psr.segment_index = s.segment_index
  WHERE o.campaign_id = p_campaign_id
    AND o.status IN ('generated', 'done');

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
