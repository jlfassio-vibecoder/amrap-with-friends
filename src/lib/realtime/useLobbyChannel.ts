import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';
import { getLobby, type LobbySessionState, type LobbySnapshot } from '@/lib/api/lobby';

export type LobbyPresenceByMemberId = Record<string, { nickname: string }>;

export interface UseLobbyChannelResult {
  lobby: LobbySnapshot | null;
  presenceByMemberId: LobbyPresenceByMemberId;
  isConnected: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function parseLobbyRow(record: Record<string, unknown>): Partial<LobbySnapshot> | null {
  const lobbyId = typeof record.id === 'string' ? record.id : null;
  const hostUserId = typeof record.host_user_id === 'string' ? record.host_user_id : null;
  const status = record.status === 'open' || record.status === 'closed' ? record.status : null;
  if (!lobbyId || !hostUserId || !status) {
    return null;
  }
  const activeSessionState =
    record.active_session_state === 'waiting' ||
    record.active_session_state === 'setup' ||
    record.active_session_state === 'work' ||
    record.active_session_state === 'finished'
      ? (record.active_session_state as LobbySessionState)
      : undefined;
  return {
    lobbyId,
    hostUserId,
    activeSessionId: typeof record.active_session_id === 'string' ? record.active_session_id : null,
    ...(activeSessionState !== undefined ? { activeSessionState } : {}),
    status,
    createdAt: typeof record.created_at === 'string' ? record.created_at : '',
    updatedAt: typeof record.updated_at === 'string' ? record.updated_at : '',
  };
}

/**
 * Subscribe to lobby:{lobbyId} for postgres_changes + optional presence.
 * Snapshot load and lobbies/members filters run whenever lobbyId is set;
 * presence track only when memberId + nickname are provided.
 */
export function useLobbyChannel(
  lobbyId: string | undefined,
  presence: { memberId: string; nickname: string } | null
): UseLobbyChannelResult {
  const [lobby, setLobby] = useState<LobbySnapshot | null>(null);
  const [presenceByMemberId, setPresenceByMemberId] = useState<LobbyPresenceByMemberId>({});
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const cancelledRef = useRef(false);

  const presenceMemberId = presence?.memberId;
  const presenceNickname = presence?.nickname;

  async function refresh() {
    if (!lobbyId) {
      return;
    }
    const result = await getLobby(lobbyId);
    if (cancelledRef.current) {
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
      setLobby(null);
      setPresenceByMemberId({});
      setIsConnected(false);
      return;
    }

    const supabase = getSupabaseClient();
    cancelledRef.current = false;

    void refresh();

    const channel = supabase.channel(`lobby:${lobbyId}`, {
      config: presenceMemberId ? { presence: { key: presenceMemberId } } : {},
    });
    channelRef.current = channel;

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
          if (sessionChanged) {
            // lobbies row has no session state; refetch so force-nav sees live state.
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
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      void supabase.removeChannel(channel);
      channelRef.current = null;
      setIsConnected(false);
    };
    // refresh closes over lobbyId; intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyId, presenceMemberId, presenceNickname]);

  return {
    lobby,
    presenceByMemberId,
    isConnected,
    error,
    refresh,
  };
}
