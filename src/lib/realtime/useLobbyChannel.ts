import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';
import { getLobby, type LobbySessionState, type LobbySnapshot } from '@/lib/api/lobby';

export type LobbyPresenceByMemberId = Record<string, { nickname: string }>;

/** Guests cannot SELECT lobby tables (membership RLS); poll get_lobby instead. */
export const GUEST_LOBBY_POLL_MS = 5_000;

export interface UseLobbyChannelResult {
  lobby: LobbySnapshot | null;
  presenceByMemberId: LobbyPresenceByMemberId;
  isConnected: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function parseLobbyRow(record: Record<string, unknown>): Partial<LobbySnapshot> | null {
  const lobbyId = typeof record.id === 'string' ? record.id : null;
  const status = record.status === 'open' || record.status === 'closed' ? record.status : null;
  if (!lobbyId || !status) {
    return null;
  }
  // host_user_id is not in the anon SELECT grant, so a guest's payload carries
  // everything except that column. Dropping the whole row when it is absent
  // would cost guests every active_session_id change — and with it the forced
  // launch into the next mission.
  const hostUserId = typeof record.host_user_id === 'string' ? record.host_user_id : null;
  const activeSessionState =
    record.active_session_state === 'waiting' ||
    record.active_session_state === 'setup' ||
    record.active_session_state === 'work' ||
    record.active_session_state === 'finished'
      ? (record.active_session_state as LobbySessionState)
      : undefined;
  return {
    lobbyId,
    ...(hostUserId !== null ? { hostUserId } : {}),
    activeSessionId: typeof record.active_session_id === 'string' ? record.active_session_id : null,
    ...(activeSessionState !== undefined ? { activeSessionState } : {}),
    status,
    createdAt: typeof record.created_at === 'string' ? record.created_at : '',
    updatedAt: typeof record.updated_at === 'string' ? record.updated_at : '',
    ...(typeof record.next_mission_pending_at === 'string'
      ? { nextMissionPendingAt: record.next_mission_pending_at }
      : record.next_mission_pending_at === null
        ? { nextMissionPendingAt: null }
        : {}),
  };
}

/**
 * Subscribe to lobby:{lobbyId} for optional postgres_changes + presence.
 * Snapshot load always uses get_lobby. Table Realtime is only for authenticated
 * members (membership RLS); guests poll get_lobby.
 */
export function useLobbyChannel(
  lobbyId: string | undefined,
  presence: { memberId: string; nickname: string } | null,
  options?: { realtimeTables?: boolean }
): UseLobbyChannelResult {
  const realtimeTables = options?.realtimeTables === true;
  const [lobby, setLobby] = useState<LobbySnapshot | null>(null);
  const [presenceByMemberId, setPresenceByMemberId] = useState<LobbyPresenceByMemberId>({});
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const cancelledRef = useRef(false);
  const lobbyIdRef = useRef(lobbyId);
  const fetchGenRef = useRef(0);

  const presenceMemberId = presence?.memberId;
  const presenceNickname = presence?.nickname;

  async function refresh() {
    const requestedLobbyId = lobbyIdRef.current;
    if (!requestedLobbyId) {
      return;
    }
    const genAtStart = fetchGenRef.current;
    const result = await getLobby(requestedLobbyId);
    // Ignore late responses after unmount or lobbyId switch (cancelledRef alone
    // is reset when the next lobby mounts, so also compare request generation).
    if (cancelledRef.current || genAtStart !== fetchGenRef.current) {
      return;
    }
    if (result.error || !result.data) {
      setError(result.error?.message ?? 'Staging area not found.');
      return;
    }
    setLobby(result.data);
    setError(null);
  }

  useEffect(() => {
    if (!lobbyId) {
      fetchGenRef.current += 1;
      return;
    }

    lobbyIdRef.current = lobbyId;
    const supabase = getSupabaseClient();
    cancelledRef.current = false;

    // Snapshot load; setState only after await inside refresh (not sync in effect).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async getLobby then setState
    void refresh();

    let pollTimer: number | null = null;
    if (!realtimeTables) {
      pollTimer = window.setInterval(() => {
        void refresh();
      }, GUEST_LOBBY_POLL_MS);
    }

    const channel = supabase.channel(`lobby:${lobbyId}`, {
      config: presenceMemberId ? { presence: { key: presenceMemberId } } : {},
    });
    channelRef.current = channel;

    if (realtimeTables) {
      channel.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` },
        (payload) => {
          const parsed = parseLobbyRow(payload.new as Record<string, unknown>);
          if (!parsed) {
            return;
          }
          setLobby((prev) => {
            if (!prev) {
              return null;
            }
            const sessionChanged = parsed.activeSessionId !== prev.activeSessionId;
            if (sessionChanged || parsed.hostUserId === undefined) {
              // lobbies row has no session state; refetch so force-nav sees live
              // state. Also refetch when the payload omitted host_user_id — a
              // guest cannot read that column, and get_lobby is SECURITY DEFINER
              // so it still returns who holds command.
              void refresh();
            }
            return {
              ...prev,
              ...parsed,
              members: prev.members,
              activeSessionState: sessionChanged
                ? null
                : parsed.activeSessionState !== undefined
                  ? parsed.activeSessionState
                  : prev.activeSessionState,
            };
          });
        }
      );

      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lobby_members',
          filter: `lobby_id=eq.${lobbyId}`,
        },
        () => {
          void refresh();
        }
      );
    }

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<{ member_id?: string; nickname?: string }>();
      const next: LobbyPresenceByMemberId = {};
      for (const key of Object.keys(state)) {
        const metas = state[key] ?? [];
        for (const meta of metas) {
          const memberId = typeof meta.member_id === 'string' ? meta.member_id : key;
          const nickname =
            typeof meta.nickname === 'string' ? meta.nickname : (presenceNickname ?? 'Athlete');
          next[memberId] = { nickname };
        }
      }
      setPresenceByMemberId(next);
    });

    channel.subscribe(async (status) => {
      if (cancelledRef.current) {
        return;
      }
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        setError(null);
        if (presenceMemberId && presenceNickname) {
          await channel.track({
            member_id: presenceMemberId,
            nickname: presenceNickname,
          });
        }
      } else if (status === 'CHANNEL_ERROR') {
        setError('Realtime connection failed.');
        setIsConnected(false);
      } else if (status === 'TIMED_OUT' || status === 'CLOSED') {
        setIsConnected(false);
      }
    });

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    }

    function handleFocus() {
      void refresh();
    }

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      cancelledRef.current = true;
      fetchGenRef.current += 1;
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
      }
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      void supabase.removeChannel(channel);
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [lobbyId, presenceMemberId, presenceNickname, realtimeTables]);

  return {
    lobby: lobbyId ? lobby : null,
    presenceByMemberId: lobbyId ? presenceByMemberId : {},
    isConnected: Boolean(lobbyId) && isConnected,
    error: lobbyId ? error : null,
    refresh,
  };
}
