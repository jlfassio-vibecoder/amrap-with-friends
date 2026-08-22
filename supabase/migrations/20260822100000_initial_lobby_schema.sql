-- PR 3: Lobby schema — sessions, participants, rounds, create/join RPCs, RPC-only RLS

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_token text NOT NULL,
  duration_minutes int NOT NULL CHECK (duration_minutes BETWEEN 1 AND 60),
  workout jsonb NOT NULL,
  state text NOT NULL DEFAULT 'waiting' CHECK (state IN ('waiting', 'setup', 'work', 'finished')),
  time_left_sec int NOT NULL DEFAULT 10,
  is_paused boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  segment_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  nickname text NOT NULL,
  role text NOT NULL CHECK (role IN ('host', 'joiner')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  claim_token_hash text
);

CREATE INDEX IF NOT EXISTS idx_participants_session_id ON public.participants (session_id);

-- Required for rounds composite FK: (session_id, participant_id) -> participants (session_id, id)
ALTER TABLE public.participants
  ADD CONSTRAINT participants_session_id_id_unique UNIQUE (session_id, id);

CREATE TABLE IF NOT EXISTS public.rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants (id) ON DELETE CASCADE,
  round_index int NOT NULL,
  elapsed_sec_at_round int NOT NULL,
  segment_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, segment_index, round_index)
);

CREATE INDEX IF NOT EXISTS idx_rounds_session_id ON public.rounds (session_id);
CREATE INDEX IF NOT EXISTS idx_rounds_participant_id ON public.rounds (participant_id);

ALTER TABLE public.rounds
  ADD CONSTRAINT rounds_session_participant_consistency
  FOREIGN KEY (session_id, participant_id)
  REFERENCES public.participants (session_id, id);

CREATE OR REPLACE FUNCTION public.validate_workout(p_workout jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_len int;
  v_elem jsonb;
  v_name text;
  v_target int;
  v_unit text;
  i int;
BEGIN
  IF p_workout IS NULL OR jsonb_typeof(p_workout) <> 'array' THEN
    RETURN false;
  END IF;

  v_len := jsonb_array_length(p_workout);
  IF v_len < 1 OR v_len > 20 THEN
    RETURN false;
  END IF;

  FOR i IN 0..(v_len - 1) LOOP
    v_elem := p_workout -> i;
    IF jsonb_typeof(v_elem) <> 'object' THEN
      RETURN false;
    END IF;

    v_name := trim(both from v_elem ->> 'name');
    IF v_name IS NULL OR v_name = '' OR length(v_name) > 120 THEN
      RETURN false;
    END IF;

    IF v_elem ? 'target' THEN
      BEGIN
        v_target := (v_elem ->> 'target')::int;
      EXCEPTION
        WHEN OTHERS THEN
          RETURN false;
      END;
      IF v_target IS NULL OR v_target <= 0 THEN
        RETURN false;
      END IF;
    END IF;

    IF v_elem ? 'unit' THEN
      v_unit := v_elem ->> 'unit';
      IF v_unit IS NULL OR length(v_unit) > 32 THEN
        RETURN false;
      END IF;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_session(
  p_duration_minutes int,
  p_nickname text,
  p_workout jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_session_id uuid;
  v_host_token text;
  v_participant_id uuid;
  v_nickname text;
  v_claim_token text;
  v_claim_hash text;
BEGIN
  v_nickname := trim(p_nickname);
  IF v_nickname IS NULL OR v_nickname = '' OR length(v_nickname) > 50 THEN
    RAISE EXCEPTION 'Name or nickname is required (max 50 characters)';
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes < 1 OR p_duration_minutes > 60 THEN
    RAISE EXCEPTION 'Duration must be between 1 and 60 minutes';
  END IF;

  IF NOT public.validate_workout(p_workout) THEN
    RAISE EXCEPTION 'Invalid workout format';
  END IF;

  v_host_token := gen_random_uuid()::text;
  v_claim_token :=
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

  INSERT INTO public.sessions (
    host_token,
    duration_minutes,
    workout,
    state,
    time_left_sec
  )
  VALUES (
    v_host_token,
    p_duration_minutes,
    p_workout,
    'waiting',
    10
  )
  RETURNING id INTO v_session_id;

  INSERT INTO public.participants (session_id, nickname, role, claim_token_hash)
  VALUES (v_session_id, v_nickname, 'host', v_claim_hash)
  RETURNING id INTO v_participant_id;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'host_token', v_host_token,
    'participant_id', v_participant_id,
    'claim_token', v_claim_token
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.join_session(
  p_session_id uuid,
  p_nickname text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_count int;
  v_participant_id uuid;
  v_nickname text;
  v_claim_token text;
  v_claim_hash text;
BEGIN
  v_nickname := trim(p_nickname);
  IF v_nickname IS NULL OR v_nickname = '' OR length(v_nickname) > 50 THEN
    RAISE EXCEPTION 'Name or nickname is required (max 50 characters)';
  END IF;

  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  PERFORM id
  FROM public.sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.participants
  WHERE session_id = p_session_id;

  IF v_count >= 6 THEN
    RAISE EXCEPTION 'Session is full (max 6 participants)';
  END IF;

  v_claim_token :=
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_claim_hash := encode(digest(v_claim_token, 'sha256'), 'hex');

  INSERT INTO public.participants (session_id, nickname, role, claim_token_hash)
  VALUES (p_session_id, v_nickname, 'joiner', v_claim_hash)
  RETURNING id INTO v_participant_id;

  RETURN jsonb_build_object(
    'participant_id', v_participant_id,
    'claim_token', v_claim_token
  );
END;
$$;

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.sessions FROM anon, authenticated;
REVOKE ALL ON public.participants FROM anon, authenticated;
REVOKE ALL ON public.rounds FROM anon, authenticated;

GRANT SELECT (
  id,
  duration_minutes,
  workout,
  state,
  time_left_sec,
  is_paused,
  started_at,
  segment_index,
  created_at
) ON public.sessions TO anon, authenticated;

GRANT SELECT (id, session_id, nickname, role, joined_at)
  ON public.participants TO anon, authenticated;

-- Copilot suggestion ignored: guest-first lobby requires anon RPC access in PR3; add rate limits and retention in a hardening PR before production scale.
GRANT EXECUTE ON FUNCTION public.create_session(int, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_session(uuid, text) TO anon, authenticated;

ALTER TABLE public.sessions REPLICA IDENTITY FULL;
ALTER TABLE public.participants REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
