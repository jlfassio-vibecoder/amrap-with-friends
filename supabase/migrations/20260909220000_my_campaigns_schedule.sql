-- my_campaigns carries the campaign's schedule.
--
-- A campaign benchmark counts against an athlete's three personal benchmarks —
-- it is a real test on a real cadence, and the mission it costs is the same
-- mission. To apply that, the client needs to know which domain each live
-- campaign is testing in.
--
-- What ships is the raw ordered schedule, not the answer. Which occurrence is
-- the benchmark is `deriveCampaignRoles`, and that is not "the first
-- occurrence": it also requires the schedule to end by repeating its opening
-- workout, and bails when there are more repeats than any campaign length
-- schedules. Re-implementing those conditions here would be a second copy of a
-- tested rule, and the two would drift silently — the only symptom being a cap
-- that admits one benchmark too many. So Postgres ships what it already has and
-- campaignBenchmarkSlots.ts decides, using the same function the campaign
-- detail page uses.
--
-- Otherwise unchanged from 20260909140000.

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
        SELECT count(*)::int
        FROM public.campaign_occurrences o
        WHERE o.campaign_id = c.id
          AND (
            EXISTS (
              SELECT 1
              FROM public.missions s
              INNER JOIN public.participants part
                ON part.mission_id = s.id
               AND part.user_id = v_uid
              INNER JOIN public.participant_segment_results psr
                ON psr.participant_id = part.id
               AND psr.segment_index = s.segment_index
               AND psr.final_score IS NOT NULL
              WHERE s.id = o.mission_id
            )
            OR EXISTS (
              SELECT 1
              FROM public.campaign_makeups mk
              INNER JOIN public.missions s ON s.id = mk.mission_id
              INNER JOIN public.participants part
                ON part.mission_id = s.id
               AND part.user_id = v_uid
              INNER JOIN public.participant_segment_results psr
                ON psr.participant_id = part.id
               AND psr.segment_index = s.segment_index
               AND psr.final_score IS NOT NULL
              WHERE mk.occurrence_id = o.id
                AND mk.user_id = v_uid
            )
          )
      ) AS completed_missions,
      (
        SELECT count(*)::int FROM public.campaign_members cm
        WHERE cm.campaign_id = c.id AND cm.status = 'active'
      ) AS member_count,
      -- The raw schedule, in order. Deliberately raw: which occurrence is the
      -- benchmark is decided by deriveCampaignRoles, and shipping the answer
      -- from here would be a second copy of that rule.
      (
        SELECT coalesce(
          jsonb_agg(
            jsonb_build_object(
              'week_number', o.week_number,
              'template_id', o.template_id,
              'duration_minutes', o.duration_minutes
            )
            ORDER BY o.sequence ASC
          ),
          '[]'::jsonb
        )
        FROM public.campaign_occurrences o
        WHERE o.campaign_id = c.id
      ) AS schedule
    FROM public.campaigns c
    INNER JOIN public.campaign_members m
      ON m.campaign_id = c.id
     AND m.user_id = v_uid
     AND m.status = 'active'
  ) AS entry;

  RETURN jsonb_build_object('ok', true, 'campaigns', v_campaigns);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.my_campaigns() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_campaigns() TO authenticated;
