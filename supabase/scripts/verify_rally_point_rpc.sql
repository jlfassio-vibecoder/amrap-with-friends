-- Manual verification for rally point RPCs (run in Supabase SQL editor as postgres / service role).
-- pgTAP / supabase local can be added later for automated SQL tests.

-- 1) Create session
SELECT public.create_session(
  15,
  'Test Host',
  '[{"name":"Burpees","target":10,"unit":"reps"}]'::jsonb
) AS create_result;

-- 2) Confirm rows exist (service role can read host_token; anon cannot)
SELECT id, host_token, duration_minutes, workout, state
FROM public.sessions
ORDER BY created_at DESC
LIMIT 1;

SELECT id, session_id, nickname, role
FROM public.participants
ORDER BY joined_at DESC
LIMIT 2;

-- 3) Join session (replace with session_id from create_result)
-- SELECT public.join_session('<session_id>'::uuid, 'Guest One') AS join_result;

-- 4) Join should never return host_token — inspect join_result JSON keys only:
-- participant_id, claim_token

-- 5) Fill session to test cap (100 participants max; 101st join should raise 'Session is full'):
-- SELECT public.join_session('<session_id>'::uuid, 'Guest N');

-- 6) Submit partial reps after session is in work or finished (replace IDs/tokens from create/join):
-- Direct RPC writes are deprecated in Phase 4 — use the Edge Function instead:
-- supabase functions invoke submit-participant-result --body '{
--   "sessionId":"<session_id>",
--   "participantId":"<participant_id>",
--   "claimToken":"<claim_token>",
--   "partialReps":15,
--   "segmentIndex":0
-- }'
-- Expect ok=true with partialReps, repsPerRound, finalScore, and scoreBreakdown.
-- partialReps >= repsPerRound returns partial_reps_too_high.
-- A second invoke for the same participant/segment returns score_already_locked.

-- Legacy RPC should refuse writes:
-- SELECT public.submit_participant_result(
--   '<session_id>'::uuid,
--   '<participant_id>'::uuid,
--   '<claim_token>',
--   5,
--   0
-- ) AS submit_result;
-- Expect {"ok": false, "reason": "use_edge_function"}.

-- SELECT participant_id, segment_index, partial_reps, final_score, score_breakdown
-- FROM public.participant_segment_results
-- ORDER BY updated_at DESC
-- LIMIT 5;
