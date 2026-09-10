-- Raise the roster cap from 100 to 250.
--
-- 100 was a guess made before anything was measured. The load test in this
-- branch measured the read path at 100, 250, 500, 1000 and 2000 seats, and 250
-- is the last size where every number is still comfortable:
--
--   roster   counts reconcile   snapshot on drift   reconcile egress / 20 min
--      250        32.3 KB  79ms          785 KB              323 MB
--      500        64.5 KB  88ms          1.5 MB             1.29 GB
--
-- 500 is not a cliff in latency -- it is three quiet costs at once: better than
-- a gigabyte of reconcile traffic per mission, 2.5 million realtime messages
-- for one workout, and a 1.5 MB snapshot downloaded to a phone whenever a
-- client finds drift. Past 250 the fix is to stop fanning every round row out
-- to every client, not to raise this number again.
--
-- Every caller reads the limit through this function -- join_mission,
-- claim_participant_seat and the rally-point paths all call it rather than
-- carrying their own literal -- so this is the only line that has to change.
--
-- The name keeps "mission" from 20260901400000. Nothing here renames anything.

CREATE OR REPLACE FUNCTION public.mission_participant_limit()
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, extensions
AS $$ SELECT 250 $$;
