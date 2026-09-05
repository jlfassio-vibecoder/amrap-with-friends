-- Coach Article Builder (phase 1): draft/ready posts for the SEO blog.
-- RPC-only access, same posture as coach_workouts.

CREATE TABLE IF NOT EXISTS public.coach_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  slug text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  archetype text NOT NULL DEFAULT '',
  answer_first text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  body_markdown text NOT NULL DEFAULT '',
  author_display_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  pillar_path text NOT NULL DEFAULT '',
  cannibalisation_note text NOT NULL DEFAULT '',
  library_links text[] NOT NULL DEFAULT '{}',
  related_post_slugs text[] NOT NULL DEFAULT '{}',
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  published_at timestamptz,
  modified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coach_articles_status_check
    CHECK (status IN ('draft', 'ready', 'published', 'archived')),
  CONSTRAINT coach_articles_title_length CHECK (length(title) <= 200),
  CONSTRAINT coach_articles_slug_length CHECK (length(slug) <= 120),
  CONSTRAINT coach_articles_category_length CHECK (length(category) <= 64),
  CONSTRAINT coach_articles_archetype_length CHECK (length(archetype) <= 64),
  CONSTRAINT coach_articles_answer_first_length CHECK (length(answer_first) <= 2000),
  CONSTRAINT coach_articles_description_length CHECK (length(description) <= 320),
  CONSTRAINT coach_articles_body_length CHECK (length(body_markdown) <= 100000),
  CONSTRAINT coach_articles_author_length CHECK (length(author_display_name) <= 120),
  CONSTRAINT coach_articles_pillar_length CHECK (length(pillar_path) <= 200),
  CONSTRAINT coach_articles_cannibalisation_length CHECK (length(cannibalisation_note) <= 1000),
  CONSTRAINT coach_articles_photos_is_array CHECK (jsonb_typeof(photos) = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS coach_articles_slug_active_idx
  ON public.coach_articles (lower(slug))
  WHERE status <> 'archived' AND btrim(slug) <> '';

CREATE INDEX IF NOT EXISTS coach_articles_created_by_idx
  ON public.coach_articles (created_by, updated_at DESC);

CREATE INDEX IF NOT EXISTS coach_articles_status_category_idx
  ON public.coach_articles (status, category);

ALTER TABLE public.coach_articles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coach_articles FROM PUBLIC, anon, authenticated;

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
    'createdAt', p_row.created_at,
    'updatedAt', p_row.updated_at
  );
$$;

CREATE OR REPLACE FUNCTION public.coach_list_articles(
  p_status text DEFAULT NULL,
  p_category text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_status text;
  v_category text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_status := nullif(btrim(coalesce(p_status, '')), '');
  v_category := nullif(btrim(coalesce(p_category, '')), '');

  RETURN jsonb_build_object(
    'ok', true,
    'articles', (
      SELECT coalesce(jsonb_agg(a ORDER BY a.updated_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          ca.id,
          ca.title,
          ca.slug,
          ca.category,
          ca.archetype,
          ca.status,
          ca.updated_at,
          ca.updated_at AS "updatedAt"
        FROM public.coach_articles ca
        WHERE ca.created_by = v_uid
          AND (v_status IS NULL OR ca.status = v_status)
          AND (v_category IS NULL OR ca.category = v_category)
      ) a
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_list_articles(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_list_articles(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.coach_get_article(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_row public.coach_articles%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_row
  FROM public.coach_articles
  WHERE id = p_id AND created_by = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'article', null);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'article', public.coach_article_to_jsonb(v_row)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_get_article(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_get_article(uuid) TO authenticated;

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
  p_related_post_slugs text[]
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
      related_post_slugs
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
      coalesce(p_related_post_slugs, '{}')
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
  uuid, text, text, text, text, text, text, text, text, text, text, text[], text[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_upsert_article(
  uuid, text, text, text, text, text, text, text, text, text, text, text[], text[]
) TO authenticated;

CREATE OR REPLACE FUNCTION public.coach_set_article_status(p_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_status text;
  v_row public.coach_articles%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_status := btrim(coalesce(p_status, ''));
  -- Phase 1: draft ↔ ready only.
  IF v_status NOT IN ('draft', 'ready') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE public.coach_articles
  SET status = v_status, updated_at = now()
  WHERE id = p_id AND created_by = v_uid
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Article not found';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'article', public.coach_article_to_jsonb(v_row)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_set_article_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_set_article_status(uuid, text) TO authenticated;
