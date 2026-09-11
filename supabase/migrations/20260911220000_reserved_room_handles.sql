-- The reserved handle list belongs in the database, not only in the app.
--
-- Found by running phase 1's authenticated paths against production:
-- create_room is granted to `authenticated`, checkHandle() lives in TypeScript,
-- and nothing in between enforced it. Anyone with an account and the public
-- anon key could claim /@blog, /@coach, /@admin or /@creators by calling the
-- RPC directly. Verified by claiming all four, then deleting them.
--
-- The collision has no good ending once it happens: taking the handle back
-- breaks the host's shared links, leaving it breaks the route. So the check
-- moves to the only place every caller must pass through.
--
-- The seed is generated from reservedHandles() in src/lib/rooms/handles.ts,
-- which derives route segments from ROUTE_SEO. reservedHandles.test.ts parses
-- this file and fails if the two ever drift -- adding a route means adding a
-- migration, and CI says so.

CREATE TABLE IF NOT EXISTS public.reserved_handles (
  handle text PRIMARY KEY
);

REVOKE ALL ON TABLE public.reserved_handles FROM PUBLIC, anon, authenticated;
ALTER TABLE public.reserved_handles ENABLE ROW LEVEL SECURITY;

INSERT INTO public.reserved_handles (handle) VALUES
  ('about'),
  ('admin'),
  ('administrator'),
  ('api'),
  ('authors'),
  ('billing'),
  ('blog'),
  ('campaign'),
  ('campaigns'),
  ('coach'),
  ('create'),
  ('creators'),
  ('exercises'),
  ('guides'),
  ('help'),
  ('host'),
  ('hud'),
  ('intake'),
  ('join'),
  ('legal'),
  ('login'),
  ('logout'),
  ('mission'),
  ('moderator'),
  ('official'),
  ('owner'),
  ('privacy'),
  ('root'),
  ('science'),
  ('security'),
  ('settings'),
  ('signin'),
  ('signout'),
  ('signup'),
  ('squad'),
  ('staff'),
  ('stats'),
  ('status'),
  ('support'),
  ('system'),
  ('team'),
  ('terms')
ON CONFLICT (handle) DO NOTHING;

-- create_room, with the reserved check added. Otherwise unchanged from
-- 20260911210000.
CREATE OR REPLACE FUNCTION public.create_room(
  p_handle text,
  p_display_name text,
  p_kind text DEFAULT 'coach',
  p_timezone text DEFAULT 'UTC'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_handle text := lower(btrim(coalesce(p_handle, '')));
  v_host_account_id uuid;
  v_room_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  IF v_handle !~ '^[a-z0-9][a-z0-9_]{2,23}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_handle');
  END IF;

  IF EXISTS (SELECT 1 FROM public.reserved_handles WHERE handle = v_handle) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'handle_reserved');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.room_handle_history
    WHERE lower(old_handle) = v_handle AND expires_at > now()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'handle_taken');
  END IF;

  IF EXISTS (SELECT 1 FROM public.rooms WHERE lower(handle) = v_handle) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'handle_taken');
  END IF;

  SELECT id INTO v_host_account_id
  FROM public.host_accounts
  WHERE owner_user_id = v_uid
  LIMIT 1;

  IF v_host_account_id IS NULL THEN
    INSERT INTO public.host_accounts (owner_user_id, kind, name)
    VALUES (v_uid, coalesce(p_kind, 'coach'), btrim(p_display_name))
    RETURNING id INTO v_host_account_id;
  ELSIF EXISTS (SELECT 1 FROM public.rooms WHERE host_account_id = v_host_account_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'room_exists');
  END IF;

  INSERT INTO public.rooms (host_account_id, handle, display_name, timezone)
  VALUES (v_host_account_id, v_handle, btrim(p_display_name), coalesce(p_timezone, 'UTC'))
  RETURNING id INTO v_room_id;

  INSERT INTO public.room_members (room_id, user_id, role)
  VALUES (v_room_id, v_uid, 'owner');

  RETURN jsonb_build_object(
    'ok', true,
    'room_id', v_room_id,
    'host_account_id', v_host_account_id,
    'handle', v_handle
  );
END;
$$;
