-- Follow-up to 20260909270000: prefer rally_point_member_id when grouping
-- guest duplicates so two athletes who picked the same nickname are not
-- collapsed together. Idempotent — empty duplicates already removed stay gone,
-- and pairs that no longer share an identity key are left alone.

WITH candidates AS (
  SELECT
    p.id,
    p.mission_id,
    p.role,
    p.joined_at,
    p.user_id IS NULL AS is_guest,
    -- Signed-in athletes group by account. Guests prefer rally_point_member_id
    -- when present so two people who picked the same nickname stay distinct;
    -- plain join_mission duplicates (the per-tab bug) have no member id and
    -- still fall back to normalized nickname + the sibling-with-work guard.
    coalesce(
      p.user_id::text,
      CASE
        WHEN p.rally_point_member_id IS NOT NULL
          THEN 'rpm:' || p.rally_point_member_id::text
        ELSE 'guest:' || lower(btrim(p.nickname))
      END
    ) AS identity_key,
    (
      -- Scores live on participant_segment_results, not participants.
      EXISTS (SELECT 1 FROM public.rounds r WHERE r.participant_id = p.id)
      OR EXISTS (
        SELECT 1 FROM public.participant_segment_results sr WHERE sr.participant_id = p.id
      )
      OR EXISTS (SELECT 1 FROM public.messages m WHERE m.participant_id = p.id)
      OR EXISTS (
        SELECT 1 FROM public.campaign_makeups cm WHERE cm.paced_against_participant_id = p.id
      )
    ) AS has_activity
  FROM public.participants p
  JOIN public.missions m ON m.id = p.mission_id
  WHERE m.state = 'finished'
),
ranked AS (
  SELECT
    c.*,
    count(*) OVER (PARTITION BY c.mission_id, c.identity_key) AS group_size,
    bool_or(c.has_activity) OVER (PARTITION BY c.mission_id, c.identity_key)
      AS group_has_activity,
    row_number() OVER (
      PARTITION BY c.mission_id, c.identity_key
      ORDER BY (c.role = 'host') DESC, c.has_activity DESC, c.joined_at ASC, c.id ASC
    ) AS keep_rank
  FROM candidates c
)
DELETE FROM public.participants p
USING ranked r
WHERE p.id = r.id
  AND r.group_size > 1
  AND r.keep_rank > 1
  AND NOT r.has_activity
  AND r.role <> 'host'
  AND (NOT r.is_guest OR r.group_has_activity);

DO $$
DECLARE
  v_split int;
BEGIN
  SELECT count(*)
  INTO v_split
  FROM (
    SELECT
      p.mission_id,
      coalesce(
        p.user_id::text,
        CASE
          WHEN p.rally_point_member_id IS NOT NULL
            THEN 'rpm:' || p.rally_point_member_id::text
          ELSE 'guest:' || lower(btrim(p.nickname))
        END
      ) AS identity_key
    FROM public.participants p
    JOIN public.missions m ON m.id = p.mission_id
    WHERE m.state = 'finished'
      AND (
        EXISTS (
          SELECT 1
          FROM public.participant_segment_results psr
          WHERE psr.participant_id = p.id
            AND psr.final_score IS NOT NULL
        )
        OR EXISTS (SELECT 1 FROM public.rounds r WHERE r.participant_id = p.id)
      )
    GROUP BY 1, 2
    HAVING count(*) > 1
  ) split_groups;

  IF v_split > 0 THEN
    RAISE NOTICE
      'Left % duplicate group(s) where both rows recorded work — merging a split score needs a human.',
      v_split;
  END IF;
END $$;
