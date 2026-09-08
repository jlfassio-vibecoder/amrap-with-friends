-- One-off cleanup for duplicate participants left behind by per-tab identity.
--
-- Mission identity used to live in sessionStorage, which is scoped to a single
-- browser tab. A second tab read no participant id and joined again. Signed-in
-- athletes are reclaimed by auth.uid() the next time they join, but guests have
-- no auth.uid(), so their duplicate row is permanent: an extra name on the
-- roster and an extra line on the leaderboard.
--
-- Deletion rule — deliberately conservative:
--
--   * Only finished missions. A waiting or live mission may still have someone
--     sitting in it, and removing their row mid-workout is worse than a
--     duplicate.
--   * Only rows with no activity: no rounds, no partial reps, no chat, no final
--     score, and not referenced by a campaign makeup. The duplicate this bug
--     produces is empty by construction — the athlete keeps logging in the tab
--     they started in.
--   * Never a host row. join_mission only ever inserts joiners, so a duplicate
--     host is not a thing this bug can create.
--
-- Where two rows for one athlete BOTH carry work — they logged some rounds in
-- one tab and some in the other — the score is genuinely split and merging it
-- is a scoring decision, not a cleanup. Those are left alone and counted in a
-- NOTICE at the end so they can be looked at by hand.
--
-- Guests are matched on mission + case-insensitive nickname, which is the only
-- signal they leave. Two different athletes sharing a name in one mission, who
-- both finished with nothing recorded, would collapse to one row. Both are
-- no-shows on a finished mission's roster, so nothing that counts is lost.
--
-- Re-running is a no-op: the second pass finds no empty duplicates.

WITH candidates AS (
  SELECT
    p.id,
    p.mission_id,
    p.role,
    p.joined_at,
    -- Signed-in athletes group by account; guests only have their name.
    coalesce(p.user_id::text, 'guest:' || lower(btrim(p.nickname))) AS identity_key,
    (
      p.final_score IS NOT NULL
      OR EXISTS (SELECT 1 FROM public.rounds r WHERE r.participant_id = p.id)
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
  AND r.role <> 'host';

DO $$
DECLARE
  v_split int;
BEGIN
  SELECT count(*)
  INTO v_split
  FROM (
    SELECT
      p.mission_id,
      coalesce(p.user_id::text, 'guest:' || lower(btrim(p.nickname))) AS identity_key
    FROM public.participants p
    JOIN public.missions m ON m.id = p.mission_id
    WHERE m.state = 'finished'
      AND (
        p.final_score IS NOT NULL
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
