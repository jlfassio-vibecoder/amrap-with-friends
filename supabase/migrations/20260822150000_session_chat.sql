-- PR 6: Session chat — messages table, send_message RPC, Realtime publication

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants (id) ON DELETE CASCADE,
  nickname text NOT NULL,
  body text NOT NULL,
  segment_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_session_id ON public.messages (session_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_created
  ON public.messages (session_id, created_at);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY messages_select_anon ON public.messages
  FOR SELECT TO anon, authenticated
  -- Copilot suggestion ignored: guest-first lobby needs permissive SELECT for anon Realtime; scope via claim tokens in a hardening PR.
  USING (true);

GRANT SELECT (
  id,
  session_id,
  participant_id,
  nickname,
  body,
  segment_index,
  created_at
) ON public.messages TO anon, authenticated;

ALTER TABLE public.messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.send_message(
  p_session_id uuid,
  p_participant_id uuid,
  p_claim_token text,
  p_body text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_claim_token_hash text;
  v_participant_session_id uuid;
  v_participant_user_id uuid;
  v_participant_nickname text;
  v_session_segment_index int;
  v_body text;
  v_hash text;
  v_uid uuid;
  v_authorized boolean := false;
  v_message_id uuid;
  v_created_at timestamptz;
BEGIN
  v_uid := auth.uid();

  IF p_session_id IS NULL OR p_participant_id IS NULL OR p_claim_token IS NULL THEN
    RAISE EXCEPTION 'Invalid message';
  END IF;

  IF p_body IS NULL THEN
    RAISE EXCEPTION 'Invalid message';
  END IF;

  v_body := trim(both from p_body);

  IF v_body = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'empty_body');
  END IF;

  IF length(v_body) > 500 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'body_too_long');
  END IF;

  SELECT claim_token_hash, session_id, user_id, nickname
  INTO v_claim_token_hash, v_participant_session_id, v_participant_user_id, v_participant_nickname
  FROM public.participants
  WHERE id = p_participant_id;

  IF NOT FOUND OR v_participant_session_id <> p_session_id THEN
    RAISE EXCEPTION 'Participant not found';
  END IF;

  IF v_claim_token_hash IS NOT NULL THEN
    v_hash := encode(digest(p_claim_token, 'sha256'), 'hex');
    IF v_hash = v_claim_token_hash THEN
      v_authorized := true;
    END IF;
  ELSIF v_uid IS NOT NULL
    AND v_participant_user_id IS NOT NULL
    AND v_participant_user_id = v_uid THEN
    v_authorized := true;
  END IF;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_claim_token');
  END IF;

  SELECT segment_index
  INTO v_session_segment_index
  FROM public.sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  INSERT INTO public.messages (
    session_id,
    participant_id,
    nickname,
    body,
    segment_index
  )
  VALUES (
    p_session_id,
    p_participant_id,
    v_participant_nickname,
    v_body,
    v_session_segment_index
  )
  RETURNING id, created_at INTO v_message_id, v_created_at;

  RETURN jsonb_build_object(
    'ok', true,
    'message_id', v_message_id,
    'session_id', p_session_id,
    'participant_id', p_participant_id,
    'nickname', v_participant_nickname,
    'body', v_body,
    'segment_index', v_session_segment_index,
    'created_at', v_created_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_message(uuid, uuid, text, text) TO anon, authenticated;
