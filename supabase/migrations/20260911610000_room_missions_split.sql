-- list_room_missions: answer the two questions separately.
--
-- The previous version returned one list capped at 20 newest, and the client
-- worked out "next" and "run this again" from it. Both answers could fall off
-- the end: an older scheduled mission can be the *earliest upcoming* one, and
-- the only completed mission can sit behind twenty newer scheduled rows. A cap
-- applied before the decision is a cap on the decision.
--
-- Also returns when a mission was actually completed. `created_at` is when it
-- was scheduled, which is not the same order: a mission created on Monday for
-- next Tuesday finishes after one created and run on Wednesday, and sorting
-- "most recently finished" by created_at picks the wrong one to repeat.

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
  -- Soonest first, so the head of this list is the next mission whatever else
  -- the room has queued. An undated mission is open now and sorts first.
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

  -- Finished, ordered by when they were actually finished.
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
        'finishers', coalesce(scored.finishers, 0)
      ) AS row
    FROM public.missions m
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS finishers, max(psr.updated_at) AS completed_at
      FROM public.participants p
      JOIN public.participant_segment_results psr
        ON psr.participant_id = p.id AND psr.segment_index = m.segment_index
      WHERE p.mission_id = m.id AND psr.final_score IS NOT NULL
    ) scored ON true
    WHERE m.room_id = p_room_id
      AND m.state = 'finished'
    ORDER BY coalesce(scored.completed_at, m.created_at) DESC
    LIMIT v_limit
  ) recent;

  RETURN jsonb_build_object('ok', true, 'upcoming', v_upcoming, 'recent', v_recent);
END;
$$;

REVOKE ALL ON FUNCTION public.list_room_missions(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_room_missions(uuid, int) TO anon, authenticated;
