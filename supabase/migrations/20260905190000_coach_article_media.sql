-- Phase 2: coach article photos — dedicated public bucket + upsert p_photos.

INSERT INTO storage.buckets (id, name, public)
VALUES ('coach-article-media', 'coach-article-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY coach_article_media_select ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'coach-article-media');

CREATE POLICY coach_article_media_insert ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'coach-article-media'
    AND public.is_coach()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY coach_article_media_update ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'coach-article-media'
    AND public.is_coach()
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'coach-article-media'
    AND public.is_coach()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY coach_article_media_delete ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'coach-article-media'
    AND public.is_coach()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE OR REPLACE FUNCTION public.validate_coach_article_photos(p_photos jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_len int;
  v_elem jsonb;
  v_path text;
  v_alt text;
  i int;
BEGIN
  IF p_photos IS NULL OR jsonb_typeof(p_photos) <> 'array' THEN
    RETURN false;
  END IF;

  v_len := jsonb_array_length(p_photos);
  IF v_len > 20 THEN
    RETURN false;
  END IF;

  FOR i IN 0..(v_len - 1) LOOP
    v_elem := p_photos -> i;
    IF jsonb_typeof(v_elem) <> 'object' THEN
      RETURN false;
    END IF;

    v_path := v_elem ->> 'path';
    IF v_path IS NULL OR btrim(v_path) = '' OR length(v_path) > 500 THEN
      RETURN false;
    END IF;

    v_alt := v_elem ->> 'alt';
    IF v_alt IS NULL OR btrim(v_alt) = '' OR length(v_alt) > 300 THEN
      RETURN false;
    END IF;

    IF v_elem ? 'caption' AND length(coalesce(v_elem ->> 'caption', '')) > 280 THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

DROP FUNCTION IF EXISTS public.coach_upsert_article(
  uuid, text, text, text, text, text, text, text, text, text, text, text[], text[]
);

CREATE OR REPLACE FUNCTION public.coach_upsert_article(
  p_id uuid,
  p_title text,
  p_slug text,
  p_category text,
  p_archetype text,
  p_answer_first text,
  p_description text,
  p_body_markdown text,
  p_author_display_name text,
  p_pillar_path text,
  p_cannibalisation_note text,
  p_library_links text[],
  p_related_post_slugs text[],
  p_photos jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_title text;
  v_slug text;
  v_photos jsonb;
  v_row public.coach_articles%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_title := btrim(coalesce(p_title, ''));
  v_slug := lower(btrim(coalesce(p_slug, '')));

  IF v_title = '' THEN
    RAISE EXCEPTION 'Title is required';
  END IF;
  IF length(v_title) > 200 THEN
    RAISE EXCEPTION 'Title must be at most 200 characters';
  END IF;
  IF v_slug = '' THEN
    RAISE EXCEPTION 'Slug is required';
  END IF;
  IF v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Slug must be lowercase kebab-case';
  END IF;
  IF length(v_slug) > 120 THEN
    RAISE EXCEPTION 'Slug must be at most 120 characters';
  END IF;

  v_photos := coalesce(p_photos, '[]'::jsonb);
  IF NOT public.validate_coach_article_photos(v_photos) THEN
    RAISE EXCEPTION 'Invalid photo list — each photo needs a path and alt text';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.coach_articles (
      created_by,
      title,
      slug,
      category,
      archetype,
      answer_first,
      description,
      body_markdown,
      author_display_name,
      pillar_path,
      cannibalisation_note,
      library_links,
      related_post_slugs,
      photos
    )
    VALUES (
      v_uid,
      v_title,
      v_slug,
      btrim(coalesce(p_category, '')),
      btrim(coalesce(p_archetype, '')),
      coalesce(p_answer_first, ''),
      coalesce(p_description, ''),
      coalesce(p_body_markdown, ''),
      btrim(coalesce(p_author_display_name, '')),
      btrim(coalesce(p_pillar_path, '')),
      coalesce(p_cannibalisation_note, ''),
      coalesce(p_library_links, '{}'),
      coalesce(p_related_post_slugs, '{}'),
      v_photos
    )
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.coach_articles
    SET
      title = v_title,
      slug = v_slug,
      category = btrim(coalesce(p_category, '')),
      archetype = btrim(coalesce(p_archetype, '')),
      answer_first = coalesce(p_answer_first, ''),
      description = coalesce(p_description, ''),
      body_markdown = coalesce(p_body_markdown, ''),
      author_display_name = btrim(coalesce(p_author_display_name, '')),
      pillar_path = btrim(coalesce(p_pillar_path, '')),
      cannibalisation_note = coalesce(p_cannibalisation_note, ''),
      library_links = coalesce(p_library_links, '{}'),
      related_post_slugs = coalesce(p_related_post_slugs, '{}'),
      photos = v_photos,
      updated_at = now()
    WHERE id = p_id AND created_by = v_uid
    RETURNING * INTO v_row;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Article not found';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'article', public.coach_article_to_jsonb(v_row)
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Slug is already in use';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_upsert_article(
  uuid, text, text, text, text, text, text, text, text, text, text, text[], text[], jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_upsert_article(
  uuid, text, text, text, text, text, text, text, text, text, text, text[], text[], jsonb
) TO authenticated;
