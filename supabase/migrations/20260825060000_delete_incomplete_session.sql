-- Hard-delete incomplete sessions hosted by the authenticated athlete

CREATE OR REPLACE FUNCTION public.delete_incomplete_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_segment_index int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'Session id is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.participants p
    WHERE p.session_id = p_session_id
      AND p.user_id = v_uid
      AND p.role = 'host'
  ) THEN
    RAISE EXCEPTION 'Only the host can delete this session';
  END IF;

  SELECT s.segment_index
  INTO v_segment_index
  FROM public.sessions s
  WHERE s.id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.participants p
    INNER JOIN public.participant_segment_results psr
      ON psr.participant_id = p.id
     AND psr.segment_index = v_segment_index
    WHERE p.session_id = p_session_id
      AND psr.score_breakdown IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Completed sessions cannot be deleted';
  END IF;

  DELETE FROM public.sessions
  WHERE id = p_session_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_incomplete_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_incomplete_session(uuid) TO authenticated;
