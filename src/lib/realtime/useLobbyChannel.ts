import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';
import { getLobby, type LobbySnapshot } from '@/lib/api/lobby';

export type LobbyPresenceByMemberId = Record<string, { nickname: string }>;

export interface UseLobbyChannelResult {
  lobby: LobbySnapshot | null;
  presenceByMemberId: LobbyPresenceByMemberId;
  isConnected: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function parseLobbyRow(record: Record<string, unknown>): Partial<LobbySnapshot> | null {
  const lobbyId = typeof record.id === 'string' ? record.id : null;
  const hostUserId = typeof record.host_user_id === 'string' ? record.host_user_id : null;
  const status = record.status === 'open' || record.status === 'closed' ? record.status : null;
  if (!lobbyId || !hostUserId || !status) {
    return null;
  }
  return {
    lobbyId,
    hostUserId,
    activeSessionId:
      typeof record.active_session_id === 'string' ? record.active_session_id : null,
    status,
    createdAt: typeof record.created_at === 'string' ? record.created_at : '',
    updatedAt: typeof record.updated_at === 'string' ? record.updated_at : '',
  };
}

export function useLobbyChannel(
  lobbyId: string | undefined,
  presence: { memberId: string; nickname: string } | null
): UseLobbyChannelResult {
  const [lobby, setLobby] = useState<LobbySnapshot | null>(null);
  const [presenceByMemberId, setPresenceByMemberId] = useState<LobbyPresenceByMemberId>({});
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const presenceMemberId = presence?.memberId;
  const presenceNickname = presence?.nickname;

  async function refresh() {
    if (!lobbyId) {
      return;
    }
    const result = await getLobby(lobbyId);
    if (result.error || !result.data) {
      setError(result.error?.message ?? 'Staging area not found.');
      return;
    }
    setLobby(result.data);
    setError(null);
  }

  useEffect(() => {
    if (!lobbyId || !presenceMemberId || !presenceNickname) {
      return;
    }

    const supabase = getSupabaseClient();
    let cancelled = false;

    void refresh().then(() => {
      if (cancelled) {
        return;
      }
    });

    const channel = supabase.channel(`lobby:${lobbyId}`, {
      config: { presence: { key: presenceMemberId } },
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
        setLobby((prev) =>
          prev
            ? {
                ...prev,
                ...parsed,
                members: prev.members,
              }
            : null
        );
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
            typeof meta.nickname === 'string' ? meta.nickname : presenceNickname;
          next[memberId] = { nickname };
        }
      }
      setPresenceByMemberId(next);
    });

    channel.subscribe(async (status) => {
      if (cancelled) {
        return;
      }
      setIsConnected(status === 'SUBSCRIBED');
      if (status === 'SUBSCRIBED') {
        await channel.track({
          member_id: presenceMemberId,
          nickname: presenceNickname,
        });
      }
    });

    return () => {
      cancelled = true;
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
