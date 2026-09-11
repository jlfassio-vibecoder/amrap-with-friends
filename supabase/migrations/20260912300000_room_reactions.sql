-- Reactions on a finish.
--
-- The plan gives v1 an announcement, reactions, and the mission itself, and
-- deliberately no chat -- so this is one reaction per person per finish from a
-- fixed set, changeable and removable. Not a thread, not free text, and nothing
-- an athlete can post into.
--
-- Keyed on (participant_id, segment_index) because that is what a finish is
-- here: participant_segment_results has no surrogate id. The composite foreign
-- key means a reaction cannot exist on a finish that does not, and cascades
-- when the result goes.

CREATE TABLE IF NOT EXISTS public.room_reactions (
  room_id uuid NOT NULL REFERENCES public.rooms (id) ON DELETE CASCADE,
  participant_id uuid NOT NULL,
  segment_index int NOT NULL,
  by_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reaction text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (participant_id, segment_index, by_user_id),
  CONSTRAINT room_reactions_reaction_check
    CHECK (reaction IN ('respect', 'fire', 'grit', 'salute')),
  CONSTRAINT room_reactions_result_fk
    FOREIGN KEY (participant_id, segment_index)
    REFERENCES public.participant_segment_results (participant_id, segment_index)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_room_reactions_room ON public.room_reactions (room_id);

ALTER TABLE public.room_reactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.room_reactions FROM PUBLIC, anon, authenticated;

-- Set, change, or clear. An empty reaction removes: "take it back" is the same
-- decision as "change it", the way the announcement works.
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

  -- The room this finish belongs to, via its mission. A finish outside a room
  -- has nowhere to be reacted to.
  SELECT m.room_id INTO v_room_id
  FROM public.participants p
  JOIN public.missions m ON m.id = p.mission_id
  WHERE p.id = p_participant_id AND m.room_id IS NOT NULL;

  IF v_room_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- Reacting is something the room's hosts do, per the plan's coach list.
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

-- Recent finishes in a room, for the host to react to.
--
-- Host-only for now. The public, athlete-facing feed has a privacy question of
-- its own -- room_members.activity_visible, and guests who have no membership
-- row to carry a setting -- and it deserves answering rather than assuming.
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
        'final_score', psr.final_score,
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
