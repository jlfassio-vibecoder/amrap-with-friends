-- Lobby SELECT policies stop recursing, so authenticated Realtime works again.
--
-- 20260901300000 closed row-level lobby enumeration, which was the right call.
-- But lobby_members_select_realtime read lobby_members inside its own USING
-- clause, and lobbies_select_realtime read lobby_members too. Postgres applies
-- the policy to that inner read as well, so every direct SELECT on either table
-- raised:
--
--   ERROR: infinite recursion detected in policy for relation "lobby_members"
--
-- Nothing caught it because every lobby RPC is SECURITY DEFINER and bypasses
-- RLS -- get_lobby, join_lobby, leave_lobby and announce_next_mission all kept
-- working, and the whole test suite passes. The only caller that reads these
-- tables directly is Realtime's postgres_changes, so the failure landed
-- squarely on the one path the tests cannot reach.
--
-- The effect was backwards from the intent. Guests were deliberately moved to a
-- 5s get_lobby poll (GUEST_LOBBY_POLL_MS) and were unaffected; authenticated
-- clients subscribe to postgres_changes with no poll fallback
-- (useLobbyChannel is called with realtimeTables: isAuthenticated), so signed-in
-- crew lost the forced launch into the next mission, the live host handoff, and
-- roster updates -- recovering only when the tab regained focus.
--
-- The fix is the standard one: move the membership test into a SECURITY DEFINER
-- helper. It runs as the owner, so its own reads are not subject to RLS and the
-- policy cannot re-enter itself. The visibility rule is unchanged -- a member or
-- host sees their lobby and its roster, everyone else sees nothing.

CREATE OR REPLACE FUNCTION public.is_lobby_member(p_lobby_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lobbies l
    WHERE l.id = p_lobby_id
      AND l.host_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.lobby_members m
    WHERE m.lobby_id = p_lobby_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
  )
$$;

-- Evaluated as the querying role, so authenticated has to be able to call it.
-- Guests never reach it: both policies are TO authenticated.
REVOKE EXECUTE ON FUNCTION public.is_lobby_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_lobby_member(uuid) TO authenticated;

DROP POLICY IF EXISTS lobbies_select_realtime ON public.lobbies;
CREATE POLICY lobbies_select_realtime
  ON public.lobbies FOR SELECT TO authenticated
  USING (public.is_lobby_member(id));

DROP POLICY IF EXISTS lobby_members_select_realtime ON public.lobby_members;
CREATE POLICY lobby_members_select_realtime
  ON public.lobby_members FOR SELECT TO authenticated
  USING (public.is_lobby_member(lobby_members.lobby_id));

-- 20260901320000 granted anon SELECT on this one column, after 20260901300000
-- had revoked every anon SELECT on the table. It reads as an exception to a
-- rule that no longer has any others, and it grants nothing in practice -- there
-- is no anon SELECT policy, so anon reads zero rows either way. Aligning it with
-- 20260901300000 so the table has one story: guests reach lobbies through
-- SECURITY DEFINER RPCs, never directly.
REVOKE SELECT (next_mission_pending_at) ON public.lobbies FROM anon;
