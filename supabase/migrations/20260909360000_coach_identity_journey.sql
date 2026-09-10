-- One lifetime journey per identity, guest era included.
--
-- The coach surfaces answer "how many" well and "what happened, in order" not
-- at all. coach_user_detail lists a registered user's missions, coach_anon_summary
-- counts a guest's events by name, and coach_events_recent shows a raw feed --
-- but nothing puts a single person's missions and events on one timeline, and
-- two gaps made the question "are they actually creating and completing
-- workouts" unanswerable:
--
--   1. A registered user's guest era was invisible. analytics_identity_links
--      has stitched anon_id -> user_id since Phase 2 and no coach RPC read it,
--      so everything a user did before signing up -- which is where the
--      interesting drop-offs are -- was severed from their record.
--   2. A guest's missions were invisible. participants carries no anon_id, so
--      the only bridge from an anon_id to a mission is the mission_id and
--      participant_id that analytics_events already records. Nothing followed
--      it, so a guest who created and finished three missions looked
--      identical to one who bounced off the homepage.
--
-- This resolves an identity to the full set of anon_ids and the user_id that
-- belong to the same person, then reports lifetime totals and a merged,
-- chronological timeline of mission milestones and product events across all
-- of them.

CREATE OR REPLACE FUNCTION public.coach_identity_journey(
  p_user_id uuid DEFAULT NULL,
  p_anon_id text DEFAULT NULL,
  p_limit int DEFAULT 300
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_anon_ids text[];
  v_participant_ids uuid[];
  v_mission_ids uuid[];
  v_limit int;
  v_seed text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_limit := LEAST(GREATEST(coalesce(p_limit, 300), 1), 1000);
  v_seed := nullif(btrim(coalesce(p_anon_id, '')), '');

  IF p_user_id IS NULL AND v_seed IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'identity_required');
  END IF;

  -- Resolve the person, from whichever half of them we were handed. An anon_id
  -- that later signed up resolves to its user, and that user then pulls in
  -- every other device or browser they were seen on.
  v_user_id := p_user_id;
  IF v_user_id IS NULL THEN
    SELECT link.user_id INTO v_user_id
    FROM public.analytics_identity_links link
    WHERE link.anon_id = v_seed
    ORDER BY link.first_seen_at ASC
    LIMIT 1;
  END IF;

  SELECT coalesce(array_agg(DISTINCT a), ARRAY[]::text[])
  INTO v_anon_ids
  FROM (
    SELECT v_seed AS a WHERE v_seed IS NOT NULL
    UNION
    SELECT link.anon_id FROM public.analytics_identity_links link
    WHERE v_user_id IS NOT NULL AND link.user_id = v_user_id
  ) ids
  WHERE a IS NOT NULL;

  -- Everything this person touched, by either identity. A guest's missions are
  -- only reachable through the ids their own events recorded.
  SELECT
    coalesce(array_agg(DISTINCT ae.participant_id) FILTER (WHERE ae.participant_id IS NOT NULL), ARRAY[]::uuid[]),
    coalesce(array_agg(DISTINCT ae.mission_id) FILTER (WHERE ae.mission_id IS NOT NULL), ARRAY[]::uuid[])
  INTO v_participant_ids, v_mission_ids
  FROM public.analytics_events ae
  WHERE (v_user_id IS NOT NULL AND ae.user_id = v_user_id)
     OR (cardinality(v_anon_ids) > 0 AND ae.anon_id = ANY (v_anon_ids));

  RETURN jsonb_build_object(
    'ok', true,
    'identity', jsonb_build_object(
      'userId', v_user_id,
      'anonIds', to_jsonb(v_anon_ids),
      'nickname', (
        SELECT ap.nickname FROM public.athlete_profiles ap WHERE ap.user_id = v_user_id
      ),
      'accountCreatedAt', (
        SELECT u.created_at FROM auth.users u WHERE u.id = v_user_id
      ),
      'signedUpAt', (
        SELECT min(link.first_seen_at)
        FROM public.analytics_identity_links link
        WHERE link.user_id = v_user_id
      ),
      'firstSeenAt', (
        SELECT min(ae.occurred_at)
        FROM public.analytics_events ae
        WHERE (v_user_id IS NOT NULL AND ae.user_id = v_user_id)
           OR (cardinality(v_anon_ids) > 0 AND ae.anon_id = ANY (v_anon_ids))
      ),
      'lastSeenAt', (
        SELECT max(ae.occurred_at)
        FROM public.analytics_events ae
        WHERE (v_user_id IS NOT NULL AND ae.user_id = v_user_id)
           OR (cardinality(v_anon_ids) > 0 AND ae.anon_id = ANY (v_anon_ids))
      )
    ),
    'lifetime', (
      SELECT jsonb_build_object(
        -- Missions are counted from the participants rows, which are the
        -- record of taking part; the events only supply the join between a
        -- guest and their participant row.
        'missionsHosted', count(*) FILTER (WHERE p.role = 'host'),
        'missionsJoined', count(*) FILTER (WHERE p.role = 'joiner'),
        'missionsTotal', count(*),
        -- "Completed" is a scored result for this participant, not a finished
        -- mission: the mission can finish without them having logged anything.
        'missionsCompleted', count(*) FILTER (WHERE psr.final_score IS NOT NULL),
        'missionsFinishedState', count(*) FILTER (WHERE m.state = 'finished'),
        'bestScore', max(psr.final_score),
        'totalWorkoutMinutes', coalesce(
          sum(m.duration_minutes) FILTER (WHERE psr.final_score IS NOT NULL), 0
        ),
        'activeDays', count(DISTINCT p.joined_at::date)
      )
      FROM public.participants p
      INNER JOIN public.missions m ON m.id = p.mission_id
      LEFT JOIN public.participant_segment_results psr
        ON psr.participant_id = p.id
       AND psr.segment_index = m.segment_index
      WHERE (v_user_id IS NOT NULL AND p.user_id = v_user_id)
         OR (cardinality(v_participant_ids) > 0 AND p.id = ANY (v_participant_ids))
    ),
    'eventCounts', (
      SELECT coalesce(jsonb_object_agg(counted.event_name, counted.cnt), '{}'::jsonb)
      FROM (
        SELECT ae.event_name, count(*) AS cnt
        FROM public.analytics_events ae
        WHERE ((v_user_id IS NOT NULL AND ae.user_id = v_user_id)
            OR (cardinality(v_anon_ids) > 0 AND ae.anon_id = ANY (v_anon_ids)))
          AND ae.event_name <> 'presence_heartbeat'
        GROUP BY ae.event_name
      ) counted
    ),
    -- Missions and events on one clock. Mission rows carry the outcome so the
    -- timeline answers "did this one get finished" without a second lookup.
    'timeline', (
      SELECT coalesce(jsonb_agg(t ORDER BY t.at DESC), '[]'::jsonb)
      FROM (
        SELECT * FROM (
          SELECT
            p.joined_at AS at,
            'mission'::text AS kind,
            m.id::text AS ref,
            p.role AS detail,
            jsonb_build_object(
              'missionId', m.id,
              'role', p.role,
              'state', m.state,
              'templateId', m.template_id,
              'durationMinutes', m.duration_minutes,
              'intensityTier', m.intensity_tier,
              'finalScore', psr.final_score,
              'completed', psr.final_score IS NOT NULL,
              'guest', p.user_id IS NULL
            ) AS payload
          FROM public.participants p
          INNER JOIN public.missions m ON m.id = p.mission_id
          LEFT JOIN public.participant_segment_results psr
            ON psr.participant_id = p.id
           AND psr.segment_index = m.segment_index
          WHERE (v_user_id IS NOT NULL AND p.user_id = v_user_id)
             OR (cardinality(v_participant_ids) > 0 AND p.id = ANY (v_participant_ids))

          UNION ALL

          -- Heartbeats are presence, not behaviour; they would bury the
          -- timeline at one row per minute per open tab.
          SELECT
            ae.occurred_at AS at,
            'event'::text AS kind,
            ae.event_name AS ref,
            ae.route AS detail,
            jsonb_build_object(
              'eventName', ae.event_name,
              'route', ae.route,
              'missionId', ae.mission_id,
              'anonId', ae.anon_id,
              'signedIn', ae.user_id IS NOT NULL,
              'props', ae.props
            ) AS payload
          FROM public.analytics_events ae
          WHERE ((v_user_id IS NOT NULL AND ae.user_id = v_user_id)
              OR (cardinality(v_anon_ids) > 0 AND ae.anon_id = ANY (v_anon_ids)))
            AND ae.event_name <> 'presence_heartbeat'
        ) rows
        ORDER BY rows.at DESC
        LIMIT v_limit
      ) t
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_identity_journey(uuid, text, int)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_identity_journey(uuid, text, int) TO authenticated;
