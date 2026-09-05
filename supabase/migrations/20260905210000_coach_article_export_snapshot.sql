-- Phase 4: export snapshot on publish + service-role list for seo:pull-articles.

ALTER TABLE public.coach_articles
  ADD COLUMN IF NOT EXISTS export_snapshot jsonb;

CREATE OR REPLACE FUNCTION public.coach_article_to_jsonb(p_row public.coach_articles)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT jsonb_build_object(
    'id', p_row.id,
    'title', p_row.title,
    'slug', p_row.slug,
    'category', p_row.category,
    'archetype', p_row.archetype,
    'answerFirst', p_row.answer_first,
    'description', p_row.description,
    'bodyMarkdown', p_row.body_markdown,
    'authorDisplayName', p_row.author_display_name,
    'status', p_row.status,
    'pillarPath', p_row.pillar_path,
    'cannibalisationNote', p_row.cannibalisation_note,
    'libraryLinks', to_jsonb(p_row.library_links),
    'relatedPostSlugs', to_jsonb(p_row.related_post_slugs),
    'photos', p_row.photos,
    'publishedAt', p_row.published_at,
    'modifiedAt', p_row.modified_at,
    'exportSnapshot', p_row.export_snapshot,
    'createdAt', p_row.created_at,
    'updatedAt', p_row.updated_at
  );
$$;

CREATE OR REPLACE FUNCTION public.coach_publish_article(p_id uuid, p_snapshot jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_current text;
  v_row public.coach_articles%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_snapshot IS NULL OR jsonb_typeof(p_snapshot) <> 'object' THEN
    RAISE EXCEPTION 'Export snapshot is required';
  END IF;

  IF coalesce(btrim(p_snapshot ->> 'title'), '') = ''
     OR coalesce(btrim(p_snapshot ->> 'slug'), '') = ''
     OR coalesce(btrim(p_snapshot ->> 'description'), '') = ''
     OR coalesce(btrim(p_snapshot ->> 'answerFirst'), '') = ''
     OR coalesce(btrim(p_snapshot ->> 'author'), '') = ''
     OR p_snapshot ->> 'body' IS NULL
     OR coalesce(btrim(p_snapshot ->> 'publishedAt'), '') = ''
     OR coalesce(btrim(p_snapshot ->> 'modifiedAt'), '') = ''
     OR jsonb_typeof(p_snapshot -> 'photos') <> 'array'
  THEN
    RAISE EXCEPTION 'Export snapshot is missing required fields';
  END IF;

  SELECT status INTO v_current
  FROM public.coach_articles
  WHERE id = p_id AND created_by = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Article not found';
  END IF;

  IF v_current NOT IN ('ready', 'published') THEN
    RAISE EXCEPTION 'Mark the post ready before publishing';
  END IF;

  UPDATE public.coach_articles
  SET
    status = 'published',
    published_at = coalesce(published_at, now()),
    modified_at = now(),
    export_snapshot = p_snapshot,
    updated_at = now()
  WHERE id = p_id AND created_by = v_uid
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'article', public.coach_article_to_jsonb(v_row)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_publish_article(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_publish_article(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_published_article_exports()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  RETURN jsonb_build_object(
    'ok', true,
    'articles', (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'id', ca.id,
          'slug', ca.slug,
          'snapshot', ca.export_snapshot
        )
        ORDER BY ca.published_at DESC NULLS LAST
      ), '[]'::jsonb)
      FROM public.coach_articles ca
      WHERE ca.status = 'published'
        AND ca.export_snapshot IS NOT NULL
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_published_article_exports() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_published_article_exports() TO service_role;
