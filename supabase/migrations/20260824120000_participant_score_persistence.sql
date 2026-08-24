-- Phase 4: Persist immutable score breakdown + final_score; route writes through Edge Function

ALTER TABLE public.participant_segment_results
  ADD COLUMN IF NOT EXISTS final_score int NULL,
  ADD COLUMN IF NOT EXISTS score_breakdown jsonb NULL;

CREATE INDEX IF NOT EXISTS idx_participant_segment_results_final_score
  ON public.participant_segment_results (final_score DESC NULLS LAST);

GRANT SELECT (
  final_score,
  score_breakdown
) ON public.participant_segment_results TO anon, authenticated;

-- Deprecate direct RPC writes — clients must use submit-participant-result Edge Function
CREATE OR REPLACE FUNCTION public.submit_participant_result(
  p_session_id uuid,
  p_participant_id uuid,
  p_claim_token text,
  p_partial_reps int,
  p_segment_index int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  RETURN jsonb_build_object('ok', false, 'reason', 'use_edge_function');
END;
$$;

CREATE OR REPLACE FUNCTION public.my_sessions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_sessions jsonb;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'participant_id', p.id,
        'nickname', p.nickname,
        'joined_at', p.joined_at,
        'role', p.role,
        'session_id', s.id,
        'created_at', s.created_at,
        'duration_minutes', s.duration_minutes,
        'workout', s.workout,
        'state', s.state,
        'segment_index', s.segment_index,
        'round_count', (
          SELECT count(*)::int
          FROM public.rounds r
          WHERE r.participant_id = p.id AND r.segment_index = s.segment_index
        ),
        'partial_reps', coalesce(psr.partial_reps, 0),
        'final_score', psr.final_score,
        'score_breakdown', psr.score_breakdown
      )
      ORDER BY p.joined_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_sessions
  FROM public.participants p
  INNER JOIN public.sessions s ON s.id = p.session_id
  LEFT JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
    AND psr.segment_index = s.segment_index
  WHERE p.user_id = v_uid;

  RETURN jsonb_build_object('ok', true, 'sessions', v_sessions);
END;
$$;
