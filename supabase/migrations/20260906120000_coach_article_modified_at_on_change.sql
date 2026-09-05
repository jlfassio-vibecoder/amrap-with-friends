-- Only advance coach_articles.modified_at when the published content changed.
--
-- coach_publish_article set modified_at = now() on every publish, so
-- re-publishing an article that nobody edited claimed it had been updated.
-- Two things read that:
--
--   * the blog post's dateModified and its visible "Updated" line, via the
--     export snapshot — a freshness signal that fires on a no-op is noise;
--   * the Article Builder's refresh queue and "refreshes this month" counter,
--     which counted the no-op as a refresh and reset the staleness clock on a
--     post nobody had improved.
--
-- The comparison strips modifiedAt from both sides, since that field is the one
-- being decided and would otherwise always differ.

CREATE OR REPLACE FUNCTION public.coach_publish_article(p_id uuid, p_snapshot jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_current text;
  v_row public.coach_articles;
  v_previous jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_snapshot IS NULL
     OR jsonb_typeof(p_snapshot) <> 'object'
     OR coalesce(btrim(p_snapshot ->> 'title'), '') = ''
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

  SELECT status, export_snapshot INTO v_current, v_previous
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
    modified_at = CASE
      WHEN v_previous IS NOT NULL
       AND (v_previous - 'modifiedAt') IS NOT DISTINCT FROM (p_snapshot - 'modifiedAt')
      THEN modified_at
      ELSE now()
    END,
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
