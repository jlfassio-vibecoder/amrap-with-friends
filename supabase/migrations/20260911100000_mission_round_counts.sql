-- A cheap way for a live client to ask "am I missing anyone's rounds?"
--
-- get_mission_live_state returns every round row in the mission, and rounds is
-- its only unbounded collection: roster x rounds of them. The reconcile added
-- in 20260910/#165 pulls that full snapshot on every client every thirty
-- seconds, so the traffic grows with the square of the roster. Measured: 314 KB
-- per snapshot at 100 athletes x 10 rounds, and 1.2 GB over a 20-minute
-- mission once every client is pulling it.
--
-- The reconcile does not actually need the rows. It needs to know whether it
-- is short, which is one integer per participant. This returns that -- and the
-- newest created_at, so a client whose count happens to match but whose rows
-- are stale still notices. Only a client that finds a difference pays for the
-- full snapshot.
--
-- Authorization mirrors get_mission_live_state exactly: host token, matching
-- auth.uid, or the participant's own claim token. Round counts are already
-- visible to every seat in the mission via the leaderboard, so this exposes
-- nothing the caller could not already read -- but it must not become a way to
-- probe missions you are not in.

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
      jsonb_build_object(
        'participant_id', c.participant_id,
        'round_count', c.round_count,
        'last_round_at', c.last_round_at
      )
      ORDER BY c.participant_id
    ),
    '[]'::jsonb
  )
  INTO v_counts
  FROM (
    SELECT
      p.id AS participant_id,
      count(r.id)::int AS round_count,
      max(r.created_at) AS last_round_at
    FROM public.participants p
    LEFT JOIN public.rounds r
      ON r.participant_id = p.id
     AND r.mission_id = p_mission_id
    WHERE p.mission_id = p_mission_id
    GROUP BY p.id
  ) c;

  RETURN jsonb_build_object(
    'ok', true,
    'counts', v_counts,
    'snapshot_at', v_snapshot_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_mission_round_counts(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_mission_round_counts(uuid, uuid, text, text)
  TO anon, authenticated;

-- The reconcile runs this on every client every thirty seconds; the leaderboard
-- already reads rounds by mission, but this groups by participant.
CREATE INDEX IF NOT EXISTS idx_rounds_mission_participant
  ON public.rounds (mission_id, participant_id);
