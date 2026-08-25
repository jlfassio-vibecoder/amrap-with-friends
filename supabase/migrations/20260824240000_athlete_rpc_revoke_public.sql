-- Repair: revoke default PUBLIC EXECUTE on Phase 5 auth-only RPCs
-- (safe if 20260824230000 already applied with only GRANT TO authenticated)

REVOKE EXECUTE ON FUNCTION public.get_athlete_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_athlete_profile() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.upsert_athlete_profile(int, numeric, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_athlete_profile(int, numeric, int, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_session(int, text, jsonb, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_session(int, text, jsonb, text, int) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_session(int, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_session(int, text, jsonb) TO authenticated;
