-- Expose sessions.template_id on my_sessions so the client can resolve the
-- library workout name (coach names already come through as coach_workout_name).

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
        'scheduled_at', s.scheduled_at,
        'is_featured', coalesce(s.is_featured, false),
        'duration_minutes', s.duration_minutes,
        'workout', s.workout,
        'template_id', s.template_id,
        'state', s.state,
        'segment_index', s.segment_index,
        'round_count', (
          SELECT count(*)::int
          FROM public.rounds r
          WHERE r.participant_id = p.id AND r.segment_index = s.segment_index
        ),
        'partial_reps', coalesce(psr.partial_reps, 0),
        'final_score', psr.final_score,
        'score_breakdown', psr.score_breakdown,
        'coach_workout_name', cw.name
      )
      ORDER BY coalesce(s.scheduled_at, s.created_at) DESC
    ),
    '[]'::jsonb
  )
  INTO v_sessions
  FROM public.participants p
  INNER JOIN public.sessions s ON s.id = p.session_id
  LEFT JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
    AND psr.segment_index = s.segment_index
  LEFT JOIN public.coach_workouts cw
    ON s.template_id = 'coach:' || cw.id::text
  WHERE p.user_id = v_uid
    -- Early-cancelled featured slots (finished with no score) stay out of
    -- the list; delete is one occurrence only and should not linger as a row.
    AND NOT (
      coalesce(s.is_featured, false)
      AND s.state = 'finished'
      AND psr.score_breakdown IS NULL
    );

  RETURN jsonb_build_object('ok', true, 'sessions', v_sessions);
END;
$$;
