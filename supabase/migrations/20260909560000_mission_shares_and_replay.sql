-- Share card, phase 1: the data a card is drawn from, and a record of shares.
--
-- Two things worth reading before changing this file.
--
-- Round times are not derived here. rounds already stores elapsed_sec_at_round,
-- so `atSeconds` is a read, not a subtraction against missions.started_at --
-- which also means a paused mission or a clock adjustment cannot skew the
-- replay. Rounds are scoped to the mission's segment_index, because a mission
-- can carry more than one segment and only the current one is being shared.
--
-- Display names resolve in SQL, never on the client. A participant who chose
-- 'hidden' must not have their real name sent to somebody else's browser at
-- all, so the RPC returns "Athlete 3" and the raw name never leaves the
-- database.

-- ---------------------------------------------------------------- profile

-- How this athlete appears on *other people's* cards. A privacy control, not
-- a paid feature: it ships now even though tiers and branding do not.
ALTER TABLE public.athlete_profiles
  ADD COLUMN IF NOT EXISTS share_visibility text NOT NULL DEFAULT 'name';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'athlete_profiles_share_visibility_allowed'
  ) THEN
    ALTER TABLE public.athlete_profiles
      ADD CONSTRAINT athlete_profiles_share_visibility_allowed
      CHECK (share_visibility IN ('name', 'initials', 'hidden'));
  END IF;
END;
$$;

-- ----------------------------------------------------------------- shares

CREATE TABLE IF NOT EXISTS public.mission_shares (
  id text PRIMARY KEY,
  mission_id uuid NOT NULL REFERENCES public.missions (id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.participants (id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('card', 'replay')),
  layout text NOT NULL CHECK (layout IN ('story', 'square', 'landscape')),
  variant text NOT NULL CHECK (variant IN ('result', 'squad', 'pr', 'amqap')),
  image_path text,
  views int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mission_shares_id_shape CHECK (id ~ '^[0-9a-hjkmnp-tv-z]{8}$')
);

CREATE INDEX IF NOT EXISTS mission_shares_mission_idx ON public.mission_shares (mission_id);

ALTER TABLE public.mission_shares ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mission_shares FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------- rpcs

-- Shared by both RPCs: a guest proves it with the claim token they already
-- hold, a host with the host token, a signed-in athlete with their uid. Same
-- three doors get_mission_live_state uses; no new way in.
CREATE OR REPLACE FUNCTION public.share_caller_is_authorized(
  p_mission_id uuid,
  p_participant_id uuid,
  p_claim_token text,
  p_host_token text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_host_token text;
  v_claim_token_hash text;
  v_participant_mission_id uuid;
  v_participant_user_id uuid;
BEGIN
  IF p_mission_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT host_token INTO v_host_token FROM public.missions WHERE id = p_mission_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF p_host_token IS NOT NULL AND p_host_token = v_host_token THEN
    RETURN true;
  END IF;

  -- A signed-in participant of this mission needs no token.
  IF v_uid IS NOT NULL AND public.is_mission_participant(p_mission_id) THEN
    RETURN true;
  END IF;

  IF p_participant_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT claim_token_hash, mission_id, user_id
  INTO v_claim_token_hash, v_participant_mission_id, v_participant_user_id
  FROM public.participants
  WHERE id = p_participant_id;

  IF NOT FOUND OR v_participant_mission_id <> p_mission_id THEN
    RETURN false;
  END IF;

  IF v_claim_token_hash IS NOT NULL AND p_claim_token IS NOT NULL THEN
    RETURN encode(digest(p_claim_token, 'sha256'), 'hex') = v_claim_token_hash;
  END IF;

  RETURN v_uid IS NOT NULL
    AND v_participant_user_id IS NOT NULL
    AND v_participant_user_id = v_uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.share_caller_is_authorized(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;

-- "Justin Fassio" -> "J.F." Falls back to the first character when there is
-- only one word, and to 'Athlete' when there is nothing usable.
CREATE OR REPLACE FUNCTION public.share_initials(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(
    nullif(
      (
        SELECT string_agg(upper(left(word, 1)) || '.', '')
        FROM unnest(string_to_array(btrim(coalesce(p_name, '')), ' ')) AS word
        WHERE btrim(word) <> ''
      ),
      ''
    ),
    'Athlete'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_mission_replay(
  p_mission_id uuid,
  p_participant_id uuid DEFAULT NULL,
  p_claim_token text DEFAULT NULL,
  p_host_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_mission public.missions%ROWTYPE;
  v_cap_seconds int;
BEGIN
  IF NOT public.share_caller_is_authorized(
    p_mission_id, p_participant_id, p_claim_token, p_host_token
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;

  SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  v_cap_seconds := v_mission.duration_minutes * 60;

  RETURN jsonb_build_object(
    'ok', true,
    'mission', jsonb_build_object(
      'id', v_mission.id,
      'templateId', v_mission.template_id,
      'workout', v_mission.workout,
      'capSeconds', v_cap_seconds,
      'durationMinutes', v_mission.duration_minutes,
      'intensityTier', v_mission.intensity_tier,
      'state', v_mission.state,
      'startedAt', v_mission.started_at,
      'segmentIndex', v_mission.segment_index
    ),
    'participants', (
      SELECT coalesce(jsonb_agg(row ORDER BY row.final_score DESC NULLS LAST), '[]'::jsonb)
      FROM (
        SELECT
          p.id AS "participantId",
          p.user_id AS "userId",
          -- Resolved here so a hidden athlete's name never reaches a browser.
          CASE coalesce(ap.share_visibility, 'name')
            WHEN 'hidden' THEN 'Athlete ' || row_number() OVER (ORDER BY p.joined_at)
            WHEN 'initials' THEN public.share_initials(p.nickname)
            ELSE p.nickname
          END AS "displayName",
          (p.user_id IS NOT NULL AND p.user_id = auth.uid())
            OR (p_participant_id IS NOT NULL AND p.id = p_participant_id) AS "isMe",
          -- Counted from rounds: participant_segment_results has no round
          -- count, only the partial reps and the locked score.
          (
            SELECT count(*)
            FROM public.rounds r2
            WHERE r2.participant_id = p.id
              AND r2.segment_index = v_mission.segment_index
          ) AS "finalRounds",
          coalesce(psr.partial_reps, 0) AS "finalReps",
          psr.final_score AS final_score,
          p.role AS role,
          NULL::jsonb AS prior
        FROM public.participants p
        LEFT JOIN public.athlete_profiles ap ON ap.user_id = p.user_id
        LEFT JOIN public.participant_segment_results psr
          ON psr.participant_id = p.id
         AND psr.segment_index = v_mission.segment_index
        WHERE p.mission_id = p_mission_id
      ) row
    ),
    'rounds', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'participantId', r.participant_id,
        'n', r.round_index,
        -- Already stored, not derived: no arithmetic against started_at, so a
        -- pause cannot bend the replay. Clamped because the grace window lets
        -- a round land after the cap.
        'atSeconds', least(greatest(r.elapsed_sec_at_round, 0), v_cap_seconds)
      ) ORDER BY r.elapsed_sec_at_round), '[]'::jsonb)
      FROM public.rounds r
      WHERE r.mission_id = p_mission_id
        AND r.segment_index = v_mission.segment_index
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_mission_replay(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_mission_replay(uuid, uuid, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_mission_share(
  p_id text,
  p_mission_id uuid,
  p_participant_id uuid,
  p_kind text,
  p_layout text,
  p_variant text,
  p_claim_token text DEFAULT NULL,
  p_host_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  IF NOT public.share_caller_is_authorized(
    p_mission_id, p_participant_id, p_claim_token, p_host_token
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;

  -- Idempotent: the panel fires this once per mount with one retry, and a
  -- retry that arrives after the first succeeded must not be an error.
  INSERT INTO public.mission_shares
    (id, mission_id, participant_id, created_by, kind, layout, variant)
  VALUES
    (p_id, p_mission_id, p_participant_id, auth.uid(), p_kind, p_layout, p_variant)
  ON CONFLICT (id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'shareId', p_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_mission_share(text, uuid, uuid, text, text, text, text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_mission_share(text, uuid, uuid, text, text, text, text, text)
  TO anon, authenticated;
