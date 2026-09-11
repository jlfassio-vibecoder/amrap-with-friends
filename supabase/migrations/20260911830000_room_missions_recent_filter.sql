-- Filter unfinished missions out of `recent` before the limit, not after.
--
-- The client asks for sessions somebody completed, but the RPC returned the 20
-- newest *finished* missions regardless of whether anyone scored, and the
-- client filtered afterwards. A room with twenty abandoned missions therefore
-- hid every real one behind them, and the activity section vanished from a room
-- that had plenty of activity.
--
-- Same mistake as the one #179 fixed for `upcoming`: a limit applied before the
-- decision is a limit on the decision. This is the other half of it.

CREATE OR REPLACE FUNCTION public.list_room_missions(p_room_id uuid, p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_upcoming jsonb;
  v_recent jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(row ORDER BY ord ASC), '[]'::jsonb)
  INTO v_upcoming
  FROM (
    SELECT
      coalesce(m.scheduled_at, '-infinity'::timestamptz) AS ord,
      jsonb_build_object(
        'mission_id', m.id,
        'state', m.state,
        'duration_minutes', m.duration_minutes,
        'template_id', m.template_id,
        'scheduled_at', m.scheduled_at,
        'created_at', m.created_at,
        'finishers', 0
      ) AS row
    FROM public.missions m
    WHERE m.room_id = p_room_id
      AND m.state IN ('waiting', 'setup', 'work')
    ORDER BY coalesce(m.scheduled_at, '-infinity'::timestamptz) ASC
    LIMIT v_limit
  ) upcoming;

  SELECT coalesce(jsonb_agg(row ORDER BY ord DESC), '[]'::jsonb)
  INTO v_recent
  FROM (
    SELECT
      coalesce(scored.completed_at, m.created_at) AS ord,
      jsonb_build_object(
        'mission_id', m.id,
        'state', m.state,
        'duration_minutes', m.duration_minutes,
        'template_id', m.template_id,
        'scheduled_at', m.scheduled_at,
        'created_at', m.created_at,
        'completed_at', scored.completed_at,
        'finishers', scored.finishers
      ) AS row
    FROM public.missions m
    JOIN LATERAL (
      SELECT count(*)::int AS finishers, max(psr.updated_at) AS completed_at
      FROM public.participants p
      JOIN public.participant_segment_results psr
        ON psr.participant_id = p.id AND psr.segment_index = m.segment_index
      WHERE p.mission_id = m.id AND psr.final_score IS NOT NULL
    ) scored ON true
    WHERE m.room_id = p_room_id
      AND m.state = 'finished'
      -- Before the limit. A mission nobody finished is not a session to show,
      -- and must not occupy one of the twenty slots either.
      AND scored.finishers > 0
    ORDER BY coalesce(scored.completed_at, m.created_at) DESC
    LIMIT v_limit
  ) recent;

  RETURN jsonb_build_object('ok', true, 'upcoming', v_upcoming, 'recent', v_recent);
END;
$$;

REVOKE ALL ON FUNCTION public.list_room_missions(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_room_missions(uuid, int) TO anon, authenticated;
