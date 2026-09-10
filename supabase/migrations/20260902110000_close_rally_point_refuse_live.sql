-- Refuse closing a rally point while a linked mission is live (work).
-- Also fix the stale "staging area" host-only error string.

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
    RAISE EXCEPTION 'Only the host can close the rally point';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.missions
    WHERE rally_point_id = p_rally_point_id
      AND state = 'work'
  ) THEN
    RAISE EXCEPTION 'Cannot close while a mission is live';
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

REVOKE EXECUTE ON FUNCTION public.close_rally_point(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_rally_point(uuid) TO authenticated;
