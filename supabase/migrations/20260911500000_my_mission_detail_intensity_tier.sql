-- Return the mission's stored intensity_tier from my_mission_detail so
-- Re-launch can recreate coach / AMQAP / custom workouts without dropping it.

CREATE OR REPLACE FUNCTION public.my_mission_detail(p_mission_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_row record;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT
    s.id AS mission_id,
    s.workout,
    s.intensity_tier,
    psr.score_breakdown
  INTO v_row
  FROM public.participants p
  INNER JOIN public.missions s ON s.id = p.mission_id
  LEFT JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
    AND psr.segment_index = s.segment_index
  WHERE p.user_id = v_uid
    AND s.id = p_mission_id
  LIMIT 1;

  IF v_row.mission_id IS NULL THEN
    RAISE EXCEPTION 'Mission not found';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'mission_id', v_row.mission_id,
    'workout', coalesce(v_row.workout, '[]'::jsonb),
    'intensity_tier', v_row.intensity_tier,
    'score_breakdown', v_row.score_breakdown
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.my_mission_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_mission_detail(uuid) TO authenticated;
