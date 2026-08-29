-- Client realtime select includes is_featured (featured setup/work clock).
-- sessions uses column-level GRANTs after REVOKE ALL; without this grant,
-- .from('sessions').select('..., is_featured') returns
-- "permission denied for table sessions" and aborts the waiting-room load
-- (no participants, no host controls).

GRANT SELECT (is_featured) ON public.sessions TO anon, authenticated;
