-- Phase 3: the share link page.
--
-- What a stranger holding the link may see is the deliberate part. The card
-- PNG is public, because it has already been posted to social media -- but
-- get_mission_replay stays participants-only, so the squad board is never
-- served to someone who simply has a URL. That is why there is no
-- missions.visibility column: the question it would answer is answered by
-- publishing the image and nothing else.

-- Views, deduplicated per viewer per day, so a share that one person reloads
-- twenty times does not read as twenty people. The ip hash is computed at the
-- edge and never stored raw.
CREATE TABLE IF NOT EXISTS public.share_views (
  share_id text NOT NULL REFERENCES public.mission_shares (id) ON DELETE CASCADE,
  ip_hash text NOT NULL,
  day date NOT NULL DEFAULT current_date,
  PRIMARY KEY (share_id, ip_hash, day)
);

ALTER TABLE public.share_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.share_views FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.increment_share_view(p_share_id text, p_ip_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_first_today boolean := false;
BEGIN
  IF p_share_id IS NULL OR p_ip_hash IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  INSERT INTO public.share_views (share_id, ip_hash, day)
  VALUES (p_share_id, left(p_ip_hash, 64), current_date)
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_first_today = ROW_COUNT;

  IF v_first_today THEN
    UPDATE public.mission_shares SET views = views + 1 WHERE id = p_share_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'counted', v_first_today);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_share_view(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_share_view(text, text) TO anon, authenticated;

-- What the /s/ page and the unfurl are allowed to know: enough for a title and
-- an image, and nothing about the other athletes. Public by design -- the link
-- is meant to be pasted into a group chat -- so it returns no names, no board
-- and no participant ids.
CREATE OR REPLACE FUNCTION public.get_share_summary(p_share_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_share public.mission_shares%ROWTYPE;
  v_mission public.missions%ROWTYPE;
  v_rounds int;
  v_reps int;
BEGIN
  SELECT * INTO v_share FROM public.mission_shares WHERE id = p_share_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO v_mission FROM public.missions WHERE id = v_share.mission_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- The sharer's own score only. Everyone else on that mission chose to be on
  -- a card, not in an API.
  SELECT
    (
      SELECT count(*) FROM public.rounds r
      WHERE r.participant_id = v_share.participant_id
        AND r.segment_index = v_mission.segment_index
    ),
    coalesce(psr.partial_reps, 0)
  INTO v_rounds, v_reps
  FROM public.participants p
  LEFT JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
   AND psr.segment_index = v_mission.segment_index
  WHERE p.id = v_share.participant_id;

  RETURN jsonb_build_object(
    'ok', true,
    'shareId', v_share.id,
    'imagePath', v_share.image_path,
    'kind', v_share.kind,
    'layout', v_share.layout,
    'templateId', v_mission.template_id,
    'durationMinutes', v_mission.duration_minutes,
    'rounds', coalesce(v_rounds, 0),
    'reps', coalesce(v_reps, 0),
    'createdAt', v_share.created_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_share_summary(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_share_summary(text) TO anon, authenticated;

-- Records where the card image landed. Authorised the same three ways
-- everything else in this feature is, so a share row cannot be pointed at
-- somebody else's image.
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

-- Public-read bucket for card images. Insert only, never update or delete:
-- combined with the 8-character unguessable share id and first-write-wins
-- above, that means nobody can replace an image behind a link that is already
-- circulating.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('mission-shares', 'mission-shares', true, 409600, ARRAY['image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 409600,
      allowed_mime_types = ARRAY['image/png', 'image/webp'];

DROP POLICY IF EXISTS mission_shares_insert ON storage.objects;
CREATE POLICY mission_shares_insert ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'mission-shares');

DROP POLICY IF EXISTS mission_shares_read ON storage.objects;
CREATE POLICY mission_shares_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'mission-shares');
