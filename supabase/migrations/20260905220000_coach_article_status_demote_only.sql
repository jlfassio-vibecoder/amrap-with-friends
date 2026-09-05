-- Phase 4 follow-up: demote/status RPC must not publish without an export snapshot.
-- Publish path is coach_publish_article only.

CREATE OR REPLACE FUNCTION public.coach_set_article_status(p_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_status text;
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

  v_status := btrim(coalesce(p_status, ''));
  -- draft/ready only — publishing requires coach_publish_article + export_snapshot.
  IF v_status NOT IN ('draft', 'ready') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT status INTO v_current
  FROM public.coach_articles
  WHERE id = p_id AND created_by = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Article not found';
  END IF;

  UPDATE public.coach_articles
  SET
    status = v_status,
    updated_at = now()
  WHERE id = p_id AND created_by = v_uid
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'article', public.coach_article_to_jsonb(v_row)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.coach_set_article_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_set_article_status(uuid, text) TO authenticated;
