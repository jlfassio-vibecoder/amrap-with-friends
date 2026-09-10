-- Drop last_round_at from get_mission_round_counts.
--
-- 20260911100000 returned it and its comment claimed a client whose counts
-- matched but whose rows were stale would still notice. Nothing ever used it:
-- the drift check compares counts and only counts. Copilot caught the comment
-- describing behaviour that was never written.
--
-- Implementing it was the other option and is not worth it. Rounds are
-- append-only within a mission id -- Reset makes a new mission -- so equal
-- counts mean equal rows, and the only thing last_round_at could add is
-- timestamp-equality across two different serialisations, which is a fragile
-- comparison guarding a case that cannot arise. The field also costs about
-- thirty bytes a seat on a call whose entire purpose is being small.

CREATE OR REPLACE FUNCTION public.get_mission_round_counts(
  p_mission_id uuid,
  p_participant_id uuid,
  p_claim_token text DEFAULT NULL,
  p_host_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_claim_token_hash text;
  v_participant_mission_id uuid;
  v_participant_user_id uuid;
  v_host_token text;
  v_hash text;
  v_authorized boolean := false;
  v_counts jsonb;
  v_snapshot_at timestamptz := clock_timestamp();
BEGIN
  v_uid := auth.uid();

  IF p_mission_id IS NULL OR p_participant_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_claim_token');
  END IF;

  SELECT claim_token_hash, mission_id, user_id
  INTO v_claim_token_hash, v_participant_mission_id, v_participant_user_id
  FROM public.participants
  WHERE id = p_participant_id;

  IF NOT FOUND OR v_participant_mission_id <> p_mission_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_claim_token');
  END IF;

  SELECT host_token
  INTO v_host_token
  FROM public.missions
  WHERE id = p_mission_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_claim_token');
  END IF;

  IF p_host_token IS NOT NULL AND p_host_token = v_host_token THEN
    v_authorized := true;
  END IF;

  IF NOT v_authorized
    AND v_uid IS NOT NULL
    AND v_participant_user_id IS NOT NULL
    AND v_participant_user_id = v_uid THEN
    v_authorized := true;
  END IF;

  IF NOT v_authorized
    AND v_claim_token_hash IS NOT NULL
    AND p_claim_token IS NOT NULL THEN
    v_hash := encode(digest(p_claim_token, 'sha256'), 'hex');
    IF v_hash = v_claim_token_hash THEN
      v_authorized := true;
    END IF;
  END IF;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_claim_token');
  END IF;

  -- Every seat in the mission, including the ones with no rounds yet: a client
  -- that has invented a participant needs to see the zero, not an absence.
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object('participant_id', c.participant_id, 'round_count', c.round_count)
      ORDER BY c.participant_id
    ),
    '[]'::jsonb
  )
  INTO v_counts
  FROM (
    SELECT p.id AS participant_id, count(r.id)::int AS round_count
    FROM public.participants p
    LEFT JOIN public.rounds r
      ON r.participant_id = p.id
     AND r.mission_id = p_mission_id
    WHERE p.mission_id = p_mission_id
    GROUP BY p.id
  ) c;

  RETURN jsonb_build_object('ok', true, 'counts', v_counts, 'snapshot_at', v_snapshot_at);
END;
$$;
