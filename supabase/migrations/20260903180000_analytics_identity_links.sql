-- Phase 2 guest tracking: durable anon_id ↔ user_id stitch on sign-in.
-- Write-only via SECURITY DEFINER RPC; no client SELECT/INSERT.

CREATE TABLE IF NOT EXISTS public.analytics_identity_links (
  anon_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (anon_id, user_id)
);

CREATE INDEX IF NOT EXISTS analytics_identity_links_user_id_idx
  ON public.analytics_identity_links (user_id);

ALTER TABLE public.analytics_identity_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.analytics_identity_links FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.link_anon_identity(p_anon_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_anon text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'auth_required');
  END IF;

  v_anon := nullif(btrim(coalesce(p_anon_id, '')), '');

  IF v_anon IS NULL
    OR v_anon = 'unknown'
    OR v_anon !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_anon_id');
  END IF;

  INSERT INTO public.analytics_identity_links (anon_id, user_id)
  VALUES (v_anon, v_uid)
  ON CONFLICT (anon_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_anon_identity(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_anon_identity(text) TO authenticated;
