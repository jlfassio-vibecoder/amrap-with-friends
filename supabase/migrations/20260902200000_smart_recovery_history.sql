-- Smart Recovery Phase 2: slim locked-completion history for client-side lock rules.
-- Lookback is 7 days — longest lock is exact-match 6 days.
--
-- Example response:
-- {
--   "ok": true,
--   "completions": [
--     {
--       "template_id": "the-piston",
--       "intensity_tier": 4,
--       "completed_at": "2026-08-24T10:00:00.000Z"
--     },
--     {
--       "template_id": null,
--       "intensity_tier": 2,
--       "completed_at": "2026-08-20T18:30:00.000Z"
--     }
--   ]
-- }
--
-- Manual verification (after replaying migrations with a signed-in user):
--   SET request.jwt.claim.sub = '<user-uuid>';
--   SELECT public.smart_recovery_history();

CREATE OR REPLACE FUNCTION public.smart_recovery_history()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public, extensions
AS $function$
DECLARE
  v_uid uuid;
  v_completions jsonb;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'template_id', s.template_id,
        'intensity_tier', coalesce(s.intensity_tier, 2),
        'completed_at', to_jsonb(psr.updated_at)
      )
      ORDER BY psr.updated_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_completions
  FROM public.participants p
  INNER JOIN public.missions s ON s.id = p.mission_id
  INNER JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
   AND psr.segment_index = s.segment_index
  WHERE p.user_id = v_uid
    AND psr.score_breakdown IS NOT NULL
    AND psr.updated_at >= now() - interval '7 days';

  RETURN jsonb_build_object('ok', true, 'completions', v_completions);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.smart_recovery_history() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.smart_recovery_history() TO authenticated;
