-- Fix: REST select on template_id returned 401 without column-level GRANT
-- (sessions table uses explicit GRANT SELECT column lists for anon/authenticated)

GRANT SELECT (template_id) ON public.sessions TO anon, authenticated;
