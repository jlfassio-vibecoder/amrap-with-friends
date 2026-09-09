-- Copilot review on PR #126. Three problems in 20260909570000, which is
-- already applied, so they are corrected here rather than edited in place.

-- 1. increment_share_view could not work at all, and was never called.
--
-- GET DIAGNOSTICS returns ROW_COUNT as bigint and the target was declared
-- boolean, which Postgres has no assignment cast for. And an unknown share id
-- hit the foreign key before any of that, raising 23503 to the caller instead
-- of the {ok:false} the function promises -- verified against the live
-- database. A view counter is called from a page a stranger opened, so it has
-- to answer rather than throw.
CREATE OR REPLACE FUNCTION public.increment_share_view(p_share_id text, p_ip_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_inserted int := 0;
BEGIN
  IF p_share_id IS NULL OR p_ip_hash IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  -- Checked before the insert, so a bad link is a quiet miss rather than a
  -- foreign key violation surfacing as a 500 on someone's first visit.
  IF NOT EXISTS (SELECT 1 FROM public.mission_shares WHERE id = p_share_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  INSERT INTO public.share_views (share_id, ip_hash, day)
  VALUES (p_share_id, left(p_ip_hash, 64), current_date)
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted > 0 THEN
    UPDATE public.mission_shares SET views = views + 1 WHERE id = p_share_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'counted', v_inserted > 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_share_view(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_share_view(text, text) TO anon, authenticated;

-- 2. The image path was taken on trust.
--
-- The PR claimed an image "cannot be swapped". That was true of the object --
-- storage is insert-only -- but not of the pointer: an authorised caller could
-- aim their own share row at any key in the public bucket. The path must now
-- be this share's own id and an allowed extension, which makes the claim
-- actually hold.
CREATE OR REPLACE FUNCTION public.set_mission_share_image(
  p_share_id text,
  p_image_path text,
  p_participant_id uuid DEFAULT NULL,
  p_claim_token text DEFAULT NULL,
  p_host_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_mission_id uuid;
BEGIN
  IF p_image_path IS DISTINCT FROM (p_share_id || '.png')
     AND p_image_path IS DISTINCT FROM (p_share_id || '.webp') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_path');
  END IF;

  SELECT mission_id INTO v_mission_id FROM public.mission_shares WHERE id = p_share_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF NOT public.share_caller_is_authorized(
    v_mission_id, p_participant_id, p_claim_token, p_host_token
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;

  -- First write wins: an image is what someone already posted, and a later
  -- overwrite would change the picture under a link already in the wild.
  UPDATE public.mission_shares
  SET image_path = p_image_path
  WHERE id = p_share_id AND image_path IS NULL;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_mission_share_image(text, text, uuid, text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_mission_share_image(text, text, uuid, text, text)
  TO anon, authenticated;

-- 3. The bucket accepted any filename from anon.
--
-- `WITH CHECK (bucket_id = 'mission-shares')` let anyone write arbitrary keys
-- into a public bucket. Uploads must now be named for a share that actually
-- exists, which needs a definer function because mission_shares is revoked
-- from anon and a policy runs as the caller.
CREATE OR REPLACE FUNCTION public.share_exists(p_share_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT EXISTS (SELECT 1 FROM public.mission_shares WHERE id = p_share_id);
$$;

REVOKE EXECUTE ON FUNCTION public.share_exists(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.share_exists(text) TO anon, authenticated;

DROP POLICY IF EXISTS mission_shares_insert ON storage.objects;
CREATE POLICY mission_shares_insert ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'mission-shares'
    AND name ~ '^[0-9a-hjkmnp-tv-z]{8}\.(png|webp)$'
    AND public.share_exists(split_part(name, '.', 1))
  );
