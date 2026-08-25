-- Phase 6.5: T-Minus lobby countdown

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS lobby_countdown_ends_at timestamptz NULL;

GRANT SELECT (lobby_countdown_ends_at) ON public.sessions TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_lobby_countdown(
  p_session_id uuid,
  p_host_token text,
  p_seconds int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_host_token text;
  v_state text;
  v_ends_at timestamptz;
BEGIN
  IF p_session_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT host_token, state
  INTO v_host_token, v_state
  FROM public.sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF p_host_token IS NULL OR p_host_token <> v_host_token THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_host_token');
  END IF;

  IF v_state <> 'waiting' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session_not_waiting');
  END IF;

  IF p_seconds IS NULL OR p_seconds <= 0 OR p_seconds > 600 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_seconds');
  END IF;

  v_ends_at := now() + (p_seconds * interval '1 second');

  UPDATE public.sessions
  SET lobby_countdown_ends_at = v_ends_at
  WHERE id = p_session_id AND host_token = p_host_token;

  RETURN jsonb_build_object(
    'ok', true,
    'lobby_countdown_ends_at', v_ends_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_lobby_countdown(uuid, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_lobby_countdown(uuid, text, int)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.cancel_lobby_countdown(
  p_session_id uuid,
  p_host_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_host_token text;
  v_state text;
BEGIN
  IF p_session_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT host_token, state
  INTO v_host_token, v_state
  FROM public.sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF p_host_token IS NULL OR p_host_token <> v_host_token THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_host_token');
  END IF;

  IF v_state <> 'waiting' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session_not_waiting');
  END IF;

  UPDATE public.sessions
  SET lobby_countdown_ends_at = NULL
  WHERE id = p_session_id AND host_token = p_host_token;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_lobby_countdown(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_lobby_countdown(uuid, text)
  TO anon, authenticated;
