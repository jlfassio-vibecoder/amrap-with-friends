-- Fix what "reps" means, in the one place both room reads can share.
--
-- `list_room_finishes` (#184) and `list_room_activity` (#190) both decided the
-- unit with:
--
--   EXISTS (SELECT 1 FROM jsonb_array_elements(m.workout) e
--           WHERE (e ->> 'reps') IS NOT NULL)
--
-- No mission in this database has a `reps` key. The stored shape is
-- `{name, unit, target}` -- what templateToExercises writes -- so that
-- predicate is false for every real workout and both reads have been labelling
-- rep counts as rounds. A 140-rep result reads "140 rounds".
--
-- It passed review twice because both verifications inserted a hand-made
-- workout carrying `reps` rather than scheduling one the way the product does.
-- The fixture agreed with the code and neither agreed with production.
--
-- The rule already exists in the app and is not "is there a reps key". From
-- missionChannelUtils: baseScore is total reps when repsPerRound > 0, and the
-- round count otherwise -- and computeRepsPerRound requires *every* movement to
-- carry a positive integer target in a scorable unit ('reps', 'sec', or none),
-- throwing otherwise. So a workout is rep-counted only when all of its
-- movements qualify, which is what this mirrors.
--
-- One function, called from both reads, so a third copy cannot drift again.

CREATE OR REPLACE FUNCTION public.mission_score_unit(p_workout jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT CASE
    WHEN jsonb_typeof(p_workout) = 'array'
     AND jsonb_array_length(p_workout) > 0
     AND NOT EXISTS (
       SELECT 1
       FROM jsonb_array_elements(p_workout) e
       WHERE NOT (
         -- Matched as text before casting: a missing, fractional or negative
         -- target must answer false, not raise.
         (e ->> 'target') ~ '^[0-9]+$'
         AND (e ->> 'target')::bigint > 0
         AND coalesce(e ->> 'unit', 'reps') IN ('reps', 'sec')
       )
     )
    THEN 'reps'
    ELSE 'rounds'
  END;
$$;

REVOKE ALL ON FUNCTION public.mission_score_unit(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mission_score_unit(jsonb) TO anon, authenticated;

-- list_room_activity, rebuilt against it.
CREATE OR REPLACE FUNCTION public.list_room_activity(p_room_id uuid, p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  IF p_room_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT coalesce(jsonb_agg(row ORDER BY ord DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      psr.updated_at AS ord,
      jsonb_build_object(
        -- The athlete's own device holds this for the missions it ran, so a
        -- guest can recognise their own row without the server knowing who is
        -- looking. A bare uuid that identifies nothing on its own.
        'participant_id', p.id,
        'mission_id', m.id,
        'template_id', m.template_id,
        -- Named only for a current member who has not opted out. Everyone
        -- else, guest or opted-out member alike, is null.
        'nickname', CASE
          WHEN EXISTS (
            SELECT 1 FROM public.room_members rm
            WHERE rm.room_id = p_room_id
              AND rm.user_id = p.user_id
              AND rm.left_at IS NULL
              AND rm.activity_visible
          ) THEN p.nickname
          ELSE NULL
        END,
        -- The reps or rounds the athlete actually did. final_score is the
        -- P.V.I.- and domain-adjusted number and is not what "140 reps" means.
        'base_score', (psr.score_breakdown ->> 'baseScore')::numeric,
        'score_unit', public.mission_score_unit(m.workout),
        'finished_at', psr.updated_at,
        -- How many hosts said "I saw that". The count, never who: an athlete
        -- seeing their coach noticed is the return loop the reaction was built
        -- for, and until now nothing showed it to them at all.
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

  RETURN jsonb_build_object('ok', true, 'activity', v_rows);
END;
$$;

-- list_room_finishes, rebuilt against it.
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
        'score_unit', public.mission_score_unit(m.workout),
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

REVOKE ALL ON FUNCTION public.list_room_activity(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_room_activity(uuid, int) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.list_room_finishes(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_room_finishes(uuid, int) TO authenticated;
