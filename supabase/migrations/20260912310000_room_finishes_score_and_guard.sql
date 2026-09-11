-- Two findings on the reactions PR.
--
-- 1. The list returned final_score and the UI printed it as reps. final_score
--    is base score adjusted by P.V.I. and Domain -- ParticipantsPanel carries a
--    comment saying exactly this: "the number shown next to 'reps' here must
--    stay the real rep count or it reads as a different -- wrong -- workout
--    result." An adjusted 230 rendered as "230 reps" is a score the athlete
--    never did.
--
--    So the list returns the base score, plus the unit it is counted in. The
--    unit is read off the workout -- whether any movement counts reps at all --
--    rather than recomputing scoring in SQL, which is the kind of duplication
--    that lets a panel and a scorer disagree.
--
-- 2. react_to_finish proved only that the participant was in a room. It never
--    checked that p_segment_index was that mission's segment, or that the
--    result was scored -- so a host could react to a partial, and a bad segment
--    reached the foreign key and raised instead of answering not_found.

CREATE OR REPLACE FUNCTION public.react_to_finish(
  p_participant_id uuid,
  p_segment_index int,
  p_reaction text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_room_id uuid;
  v_reaction text := nullif(btrim(coalesce(p_reaction, '')), '');
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  -- The room, and only for a finish that exists: the requested segment must be
  -- the mission's own, and the result must be scored. A reaction on a partial
  -- is not a thing this offers.
  SELECT m.room_id INTO v_room_id
  FROM public.participants p
  JOIN public.missions m ON m.id = p.mission_id
  JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
   AND psr.segment_index = m.segment_index
  WHERE p.id = p_participant_id
    AND m.room_id IS NOT NULL
    AND psr.segment_index = p_segment_index
    AND psr.final_score IS NOT NULL;

  IF v_room_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF coalesce(public.room_role(v_room_id, v_uid), '') NOT IN ('owner', 'cohost') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF v_reaction IS NULL THEN
    DELETE FROM public.room_reactions
    WHERE participant_id = p_participant_id
      AND segment_index = p_segment_index
      AND by_user_id = v_uid;
    RETURN jsonb_build_object('ok', true, 'reaction', NULL);
  END IF;

  IF v_reaction NOT IN ('respect', 'fire', 'grit', 'salute') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_reaction');
  END IF;

  INSERT INTO public.room_reactions (room_id, participant_id, segment_index, by_user_id, reaction)
  VALUES (v_room_id, p_participant_id, p_segment_index, v_uid, v_reaction)
  ON CONFLICT (participant_id, segment_index, by_user_id)
  DO UPDATE SET reaction = EXCLUDED.reaction, created_at = now();

  RETURN jsonb_build_object('ok', true, 'reaction', v_reaction);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_room_finishes(p_room_id uuid, p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rows jsonb;
BEGIN
  IF v_uid IS NULL OR coalesce(public.room_role(p_room_id, v_uid), '') NOT IN ('owner', 'cohost') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT coalesce(jsonb_agg(row ORDER BY ord DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      psr.updated_at AS ord,
      jsonb_build_object(
        'participant_id', p.id,
        'segment_index', psr.segment_index,
        'nickname', p.nickname,
        'mission_id', m.id,
        'template_id', m.template_id,
        -- The reps or rounds the athlete actually did, never the adjusted one.
        'base_score', (psr.score_breakdown ->> 'baseScore')::numeric,
        'score_unit', CASE
          WHEN EXISTS (
            SELECT 1 FROM jsonb_array_elements(m.workout) e
            WHERE (e ->> 'reps') IS NOT NULL
          ) THEN 'reps'
          ELSE 'rounds'
        END,
        'finished_at', psr.updated_at,
        'is_guest', p.user_id IS NULL,
        'my_reaction', (
          SELECT r.reaction FROM public.room_reactions r
          WHERE r.participant_id = p.id
            AND r.segment_index = psr.segment_index
            AND r.by_user_id = v_uid
        ),
        'reaction_count', (
          SELECT count(*) FROM public.room_reactions r
          WHERE r.participant_id = p.id AND r.segment_index = psr.segment_index
        )
      ) AS row
    FROM public.missions m
    JOIN public.participants p ON p.mission_id = m.id
    JOIN public.participant_segment_results psr
      ON psr.participant_id = p.id AND psr.segment_index = m.segment_index
    WHERE m.room_id = p_room_id
      AND psr.final_score IS NOT NULL
      AND p.role <> 'host'
    ORDER BY psr.updated_at DESC
    LIMIT least(greatest(coalesce(p_limit, 20), 1), 50)
  ) rows;

  RETURN jsonb_build_object('ok', true, 'finishes', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.react_to_finish(uuid, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.react_to_finish(uuid, int, text) TO authenticated;
REVOKE ALL ON FUNCTION public.list_room_finishes(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_room_finishes(uuid, int) TO authenticated;
