-- A second preview image per share: the wide one, for X.
--
-- og:image and twitter:image are separate tags because platforms crop
-- differently, and X is the proof. Facebook and Apple's Messages letterbox a
-- 9:16 card and show the whole thing; X crops it to roughly 1.9:1 out of the
-- vertical middle, which on a real card kept "540 reps", the movement list and
-- half the chart, and threw away the hero score, the athlete's name, the link
-- and the watermark. Measured off a posted card, not guessed.
--
-- So the portrait card stays og:image and a landscape render becomes
-- twitter:image. One card each, each the shape its reader can actually show.

ALTER TABLE public.mission_shares
  ADD COLUMN IF NOT EXISTS wide_image_path text;

COMMENT ON COLUMN public.mission_shares.wide_image_path IS
  'Landscape render for twitter:image. Null until uploaded; consumers fall back to image_path.';

-- `{id}-wide.png` alongside `{id}.png`. The suffix is part of the policy
-- rather than a free-form name so the bucket still cannot be written to with
-- arbitrary keys.
DROP POLICY IF EXISTS mission_shares_insert ON storage.objects;
CREATE POLICY mission_shares_insert ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'mission-shares'
    AND name ~ '^[0-9a-hjkmnp-tv-z]{8}(-wide)?\.(png|webp)$'
    AND public.share_exists(split_part(replace(name, '-wide', ''), '.', 1))
  );

CREATE OR REPLACE FUNCTION public.set_mission_share_image(
  p_share_id text,
  p_image_path text,
  p_participant_id uuid DEFAULT NULL,
  p_claim_token text DEFAULT NULL,
  p_host_token text DEFAULT NULL,
  p_wide_image_path text DEFAULT NULL
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

  IF p_wide_image_path IS NOT NULL
     AND p_wide_image_path IS DISTINCT FROM (p_share_id || '-wide.png')
     AND p_wide_image_path IS DISTINCT FROM (p_share_id || '-wide.webp') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_wide_path');
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

  -- First write wins, per column: an image is what someone already posted, and
  -- a later overwrite would change the picture under a link already in the
  -- wild. Per column rather than per row so the wide image can still land if
  -- it arrives after the portrait one.
  UPDATE public.mission_shares
  SET image_path = COALESCE(image_path, p_image_path),
      wide_image_path = COALESCE(wide_image_path, p_wide_image_path)
  WHERE id = p_share_id
    AND (image_path IS NULL OR (wide_image_path IS NULL AND p_wide_image_path IS NOT NULL));

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_mission_share_image(text, text, uuid, text, text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_mission_share_image(text, text, uuid, text, text, text)
  TO anon, authenticated;

-- The summary the edge middleware reads, now carrying both images. Body is
-- 20260909570000's verbatim, plus one key: rewriting it from memory is how the
-- participant/segment scoping on the score would have quietly gone missing.
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
    'wideImagePath', v_share.wide_image_path,
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
