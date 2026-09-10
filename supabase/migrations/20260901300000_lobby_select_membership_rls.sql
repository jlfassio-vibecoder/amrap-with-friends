-- Close row-level lobby enumeration for anon (and non-member authenticated).
--
-- Finding 3 revoked host_user_id / user_id from the anon SELECT grant, but the
-- policies stayed USING (true), so any client with the anon key could still
-- list every lobby / member row. Guests have no auth.uid() for membership RLS
-- to match, so they lose postgres_changes; they keep access via SECURITY
-- DEFINER get_lobby / join_lobby / leave_lobby and client-side polling.

-- ---------------------------------------------------------------------------
-- Revoke all remaining anon table SELECT (column grants from 210000 / 280000)
-- ---------------------------------------------------------------------------

REVOKE SELECT ON public.lobbies FROM anon;
REVOKE SELECT ON public.lobby_members FROM anon;

-- Re-assert authenticated grants (idempotent; matches 210000 + 280000 intent).
GRANT SELECT (
  id,
  host_user_id,
  active_session_id,
  status,
  created_at,
  updated_at
) ON public.lobbies TO authenticated;

GRANT SELECT (
  id,
  lobby_id,
  user_id,
  nickname,
  status,
  last_seen_at,
  joined_at
) ON public.lobby_members TO authenticated;

-- ---------------------------------------------------------------------------
-- Membership-scoped SELECT for authenticated Realtime only
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS lobbies_select_realtime ON public.lobbies;
DROP POLICY IF EXISTS lobby_members_select_realtime ON public.lobby_members;

CREATE POLICY lobbies_select_realtime
  ON public.lobbies FOR SELECT TO authenticated
  USING (
    host_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.lobby_members m
      WHERE m.lobby_id = lobbies.id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
  );

CREATE POLICY lobby_members_select_realtime
  ON public.lobby_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.lobbies l
      WHERE l.id = lobby_members.lobby_id
        AND (
          l.host_user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.lobby_members self
            WHERE self.lobby_id = lobby_members.lobby_id
              AND self.user_id = auth.uid()
              AND self.status = 'active'
          )
        )
    )
  );
