-- Manual verification for lobby RPCs (run in Supabase SQL editor as postgres / service role).
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
