-- Athlete-facing completed_missions is personal: count occurrences the
-- signed-in member has a usable live or makeup score for. Crew occurrence
-- status stays the scheduler calendar and must not drive list progress —
-- otherwise makeup Done on the schedule undercounts "N of M missions done".

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

REVOKE EXECUTE ON FUNCTION public.my_campaigns() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_campaigns() TO authenticated;
