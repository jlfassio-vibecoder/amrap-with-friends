-- Auth user ids leave the anonymous SELECT grant on the lobby tables.
--
-- participants draws this line deliberately: anon and authenticated are granted
-- id, joined_at, nickname, role and session_id, and user_id is withheld. The
-- lobby tables did not follow it -- lobby_members granted user_id and lobbies
-- granted host_user_id, both under a policy of USING (true) -- so any
-- unauthenticated client could enumerate every lobby and read each member's
-- auth uuid.
--
-- The epic's own risk table says "no host_token in SELECT grants", which was
-- honoured. user_id simply was not considered.
--
-- Authenticated clients keep both columns: the staging page needs host_user_id
-- to know who holds command and members.user_id to offer Pass Command, and an
-- authenticated caller is already identified. Guests lose nothing they can act
-- on -- a guest can never hold or pass command -- and get_lobby is
-- SECURITY DEFINER, so the initial load still carries the full roster for
-- everyone.
--
-- The row policies stay USING (true). Narrowing them to members only would cut
-- guests out of realtime entirely: an anonymous client has no identity for RLS
-- to match on, and lobby membership for a guest exists only as a row it cannot
-- prove it owns. That is a design change, not a grant fix, and it cannot be
-- verified without a live Realtime instance.

REVOKE SELECT (host_user_id) ON public.lobbies FROM anon;
REVOKE SELECT (user_id) ON public.lobby_members FROM anon;
