-- Room dashboard reads: close the NULL bypass, and count finishes honestly.
--
-- Three defects from review on the same PR that introduced them.
--
-- 1. `room_role()` returns NULL for someone who is not in the room at all, and
--    `NULL NOT IN ('owner','cohost')` evaluates to NULL, not true -- so the IF
--    never fired and the guard was skipped. Any authenticated caller could read
--    any room's roster and activity. Phase 1's set_room_cohost used
--    `IS DISTINCT FROM`, which is NULL-safe; these two did not.
--
--    The live check that passed at the time asked a *member* of the room, who
--    has role 'member' and was correctly refused. It never asked a stranger,
--    which is the case that was broken.
--
-- 2. A participant row exists from the moment someone joins, so counting
--    participants counted seats, not finishes. Completion in this schema means
--    a scored result: participant_segment_results.final_score IS NOT NULL for
--    the mission's own segment_index.
--
-- 3. Every mission creates a signed-in participant row for its host, so a host
--    who ran two missions counted as a returning athlete. That is the pilot's
--    primary metric, and it would have read as working while nobody came back.

CREATE OR REPLACE FUNCTION public.list_room_members(p_room_id uuid)
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
  -- NULL-safe: a non-member's NULL role must fail this, not skip it.
  IF v_uid IS NULL OR coalesce(public.room_role(p_room_id, v_uid), '') NOT IN ('owner', 'cohost') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT coalesce(jsonb_agg(row ORDER BY row ->> 'joined_at'), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'user_id', m.user_id,
      'role', m.role,
      'joined_at', m.joined_at,
      'nickname', (
        SELECT p.nickname
        FROM public.participants p
        JOIN public.missions mi ON mi.id = p.mission_id
        WHERE p.user_id = m.user_id AND mi.room_id = p_room_id
        ORDER BY p.joined_at DESC
        LIMIT 1
      )
    ) AS row
    FROM public.room_members m
    WHERE m.room_id = p_room_id AND m.left_at IS NULL
  ) rows;

  RETURN jsonb_build_object('ok', true, 'members', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.room_activity_summary(p_room_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_since timestamptz := now() - interval '7 days';
  v_finished_week int;
  v_athletes_week int;
  v_returning int;
  v_missions_week int;
BEGIN
  IF v_uid IS NULL OR coalesce(public.room_role(p_room_id, v_uid), '') NOT IN ('owner', 'cohost') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  -- A finish is a scored result, not a seat. Joining a mission and never
  -- logging anything is not a finish, and reporting it as one would tell a
  -- host their room is busier than it is.
  SELECT count(*), count(DISTINCT p.user_id)
  INTO v_finished_week, v_athletes_week
  FROM public.missions m
  JOIN public.participants p ON p.mission_id = m.id
  JOIN public.participant_segment_results psr
    ON psr.participant_id = p.id
   AND psr.segment_index = m.segment_index
  WHERE m.room_id = p_room_id
    AND psr.final_score IS NOT NULL
    AND m.created_at >= v_since;

  SELECT count(*) INTO v_missions_week
  FROM public.missions m
  WHERE m.room_id = p_room_id AND m.created_at >= v_since;

  -- Signed-in, and not the host. A guest who finishes twice cannot be
  -- recognised as the same person, and the host is in every mission by
  -- definition -- counting either would invent a returner.
  SELECT count(*) INTO v_returning
  FROM (
    SELECT p.user_id
    FROM public.missions m
    JOIN public.participants p ON p.mission_id = m.id
    JOIN public.participant_segment_results psr
      ON psr.participant_id = p.id
     AND psr.segment_index = m.segment_index
    WHERE m.room_id = p_room_id
      AND psr.final_score IS NOT NULL
      AND p.user_id IS NOT NULL
      AND p.role <> 'host'
    GROUP BY p.user_id
    HAVING count(DISTINCT m.id) > 1
  ) repeat_athletes;

  RETURN jsonb_build_object(
    'ok', true,
    'finished_this_week', coalesce(v_finished_week, 0),
    'athletes_this_week', coalesce(v_athletes_week, 0),
    'missions_this_week', coalesce(v_missions_week, 0),
    'returning_athletes', coalesce(v_returning, 0)
  );
END;
$$;
