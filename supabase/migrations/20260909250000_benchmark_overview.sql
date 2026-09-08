-- One round trip for the Benchmarks card, and a payload sized to it.
--
-- The card needed three RPCs on the HUD (my_benchmarks, my_missions,
-- my_campaigns) and two on the rally point (my_benchmarks, my_campaigns), on
-- surfaces every athlete loads constantly.
--
-- The round trips were the smaller half. my_missions returns each row's full
-- workout jsonb, its score breakdown, its coach-workout join and two
-- correlated chain-item counts — none of which an attempt needs. Deriving
-- attempts rather than storing them is still the right trade, but it should not
-- cost the athlete their whole mission history in workout-sized rows every time
-- they open the HUD.
--
-- So: eight columns per scored mission, and only when asked for. The rally
-- point does not need attempts at all — it only asks whether this workout is
-- already a benchmark and which slots are free — so it leaves the flag off and
-- pays nothing for them.
--
-- Deliberately still raw on the campaign side: the schedule ships as it is
-- stored and deriveCampaignRoles decides, for the reason written in
-- 20260909220000. Shipping the answer from here would be a second copy of a
-- tested rule.

CREATE OR REPLACE FUNCTION public.benchmark_overview(p_include_attempts boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $function$
DECLARE
  v_uid uuid;
  v_benchmarks jsonb;
  v_campaigns jsonb;
  v_attempts jsonb := '[]'::jsonb;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', b.id,
        'template_id', b.template_id,
        'duration_minutes', b.duration_minutes,
        'time_domain', b.time_domain,
        'version_key', b.version_key,
        'movement_variants', b.movement_variants,
        'designated_at', b.designated_at,
        'retired_at', b.retired_at
      )
      ORDER BY b.designated_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_benchmarks
  FROM public.athlete_benchmarks b
  WHERE b.user_id = v_uid;

  -- Live campaigns only: a finished one is not testing anyone and holds no
  -- slot, so there is no reason to ship its schedule.
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', c.name,
        'status', c.status,
        'schedule', (
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
        )
      )
    ),
    '[]'::jsonb
  )
  INTO v_campaigns
  FROM public.campaigns c
  INNER JOIN public.campaign_members m
    ON m.campaign_id = c.id
   AND m.user_id = v_uid
   AND m.status = 'active'
  WHERE c.status NOT IN ('complete', 'abandoned');

  IF p_include_attempts THEN
    -- Every scored mission of the caller's, because the retest gate counts
    -- missions of any kind: general training drives the adaptation, and
    -- counting only same-domain missions would push athletes toward training
    -- the test. Unscored missions are left out — an abandoned mission is not
    -- training that happened, and it can be neither an attempt nor a step
    -- toward the count.
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'mission_id', s.id,
          'template_id', s.template_id,
          'duration_minutes', s.duration_minutes,
          'created_at', s.created_at,
          'scheduled_at', s.scheduled_at,
          'final_score', psr.final_score,
          'modified_movements', psr.modified_movements,
          'movement_variants', psr.movement_variants
        )
        ORDER BY coalesce(s.scheduled_at, s.created_at) DESC
      ),
      '[]'::jsonb
    )
    INTO v_attempts
    FROM public.participants p
    INNER JOIN public.missions s ON s.id = p.mission_id
    INNER JOIN public.participant_segment_results psr
      ON psr.participant_id = p.id
     AND psr.segment_index = s.segment_index
    WHERE p.user_id = v_uid
      AND psr.final_score IS NOT NULL;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'benchmarks', v_benchmarks,
    'campaigns', v_campaigns,
    'attempts', coalesce(v_attempts, '[]'::jsonb)
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.benchmark_overview(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.benchmark_overview(boolean) TO authenticated;
