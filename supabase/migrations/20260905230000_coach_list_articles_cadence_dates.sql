-- Phase 5: list summaries need publishedAt/modifiedAt for cadence tooling.

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
      SELECT coalesce(jsonb_agg(a ORDER BY a."updatedAt" DESC), '[]'::jsonb)
      FROM (
        SELECT
          ca.id,
          ca.title,
          ca.slug,
          ca.category,
          ca.archetype,
          ca.status,
          ca.published_at AS "publishedAt",
          ca.modified_at AS "modifiedAt",
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
