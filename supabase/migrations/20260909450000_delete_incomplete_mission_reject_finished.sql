-- Reject delete when the mission clock has already finished, even if no
-- participant has locked a score_breakdown yet. Matches canDeleteMyMission.

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
  v_state text;
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

  SELECT s.segment_index, s.is_featured, s.state
  INTO v_segment_index, v_is_featured, v_state
  FROM public.missions s
  WHERE s.id = p_mission_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission not found';
  END IF;

  IF v_state = 'finished' THEN
    RAISE EXCEPTION 'Completed missions cannot be deleted';
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

REVOKE EXECUTE ON FUNCTION public.delete_incomplete_mission(p_mission_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_incomplete_mission(p_mission_id uuid) TO authenticated;
