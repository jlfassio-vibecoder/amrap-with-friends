-- Repair: get_participant_claim_status missing on hosted DB despite migration history.

CREATE OR REPLACE FUNCTION public.get_participant_claim_status(p_participant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_user_id uuid;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_participant_id IS NULL THEN
    RAISE EXCEPTION 'Invalid participant';
  END IF;

  SELECT user_id
  INTO v_user_id
  FROM public.participants
  WHERE id = p_participant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'participant_not_found');
  END IF;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'status', 'claimable');
  ELSIF v_user_id = v_uid THEN
    RETURN jsonb_build_object('ok', true, 'status', 'claimed');
  ELSE
    RETURN jsonb_build_object('ok', true, 'status', 'claimed_by_other');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_participant_claim_status(uuid) TO authenticated;
