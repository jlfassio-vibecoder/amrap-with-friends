-- missed_log_reps was added without a column GRANT. rounds uses an explicit
-- SELECT column list for anon/authenticated (same pattern as missions), so
-- PostgREST 403s when the client selects the new column.

GRANT SELECT (missed_log_reps) ON public.rounds TO anon, authenticated;
