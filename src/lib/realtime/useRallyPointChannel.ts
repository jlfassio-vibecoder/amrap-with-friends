import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';
import {
  getRallyPoint,
  type RallyPointMissionState,
  type RallyPointSnapshot,
} from '@/lib/api/rallyPoint';

export type RallyPointPresenceByMemberId = Record<string, { nickname: string }>;

/** Guests cannot SELECT rallyPoint tables (membership RLS); poll get_rally_point instead. */
export const GUEST_RALLY_POINT_POLL_MS = 5_000;

export interface UseRallyPointChannelResult {
  rallyPoint: RallyPointSnapshot | null;
  presenceByMemberId: RallyPointPresenceByMemberId;
  isConnected: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function parseRallyPointRow(
  record: Record<string, unknown>
): Partial<RallyPointSnapshot> | null {
  const rallyPointId = typeof record.id === 'string' ? record.id : null;
  const status = record.status === 'open' || record.status === 'closed' ? record.status : null;
  if (!rallyPointId || !status) {
    return null;
  }
  // host_user_id is not in the anon SELECT grant, so a guest's payload carries
  // everything except that column. Dropping the whole row when it is absent
  // would cost guests every active_mission_id change — and with it the forced
  // launch into the next mission.
  const hostUserId = typeof record.host_user_id === 'string' ? record.host_user_id : null;
  const activeMissionState =
    record.active_mission_state === 'waiting' ||
    record.active_mission_state === 'setup' ||
    record.active_mission_state === 'work' ||
    record.active_mission_state === 'finished'
      ? (record.active_mission_state as RallyPointMissionState)
      : undefined;
  return {
    rallyPointId,
    ...(hostUserId !== null ? { hostUserId } : {}),
    activeMissionId: typeof record.active_mission_id === 'string' ? record.active_mission_id : null,
    ...(activeMissionState !== undefined ? { activeMissionState } : {}),
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
 * Subscribe to rallyPoint:{rallyPointId} for optional postgres_changes + presence.
 * Snapshot load always uses get_rally_point. Table Realtime is only for authenticated
 * members (membership RLS); guests poll get_rally_point.
 */
export function useRallyPointChannel(
  rallyPointId: string | undefined,
  presence: { memberId: string; nickname: string } | null,
  options?: { realtimeTables?: boolean }
): UseRallyPointChannelResult {
  const realtimeTables = options?.realtimeTables === true;
  const [rallyPoint, setRallyPoint] = useState<RallyPointSnapshot | null>(null);
  const [presenceByMemberId, setPresenceByMemberId] = useState<RallyPointPresenceByMemberId>({});
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const cancelledRef = useRef(false);
  const rallyPointIdRef = useRef(rallyPointId);
  const fetchGenRef = useRef(0);

  const presenceMemberId = presence?.memberId;
  const presenceNickname = presence?.nickname;

  async function refresh() {
    const requestedRallyPointId = rallyPointIdRef.current;
    if (!requestedRallyPointId) {
      return;
    }
    const genAtStart = fetchGenRef.current;
    const result = await getRallyPoint(requestedRallyPointId);
    // Ignore late responses after unmount or rallyPointId switch (cancelledRef alone
    // is reset when the next rallyPoint mounts, so also compare request generation).
    if (cancelledRef.current || genAtStart !== fetchGenRef.current) {
      return;
    }
    if (result.error || !result.data) {
      setError(result.error?.message ?? 'Rally point not found.');
      return;
    }
    setRallyPoint(result.data);
    setError(null);
  }

  useEffect(() => {
    if (!rallyPointId) {
      fetchGenRef.current += 1;
      return;
    }

    rallyPointIdRef.current = rallyPointId;
    const supabase = getSupabaseClient();
    cancelledRef.current = false;

    // Snapshot load; setState only after await inside refresh (not sync in effect).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async getRallyPoint then setState
    void refresh();

    let pollTimer: number | null = null;
    if (!realtimeTables) {
      pollTimer = window.setInterval(() => {
        void refresh();
      }, GUEST_RALLY_POINT_POLL_MS);
    }

    const channel = supabase.channel(`rallyPoint:${rallyPointId}`, {
      config: presenceMemberId ? { presence: { key: presenceMemberId } } : {},
    });
    channelRef.current = channel;

    if (realtimeTables) {
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rallyPoints',
          filter: `id=eq.${rallyPointId}`,
        },
        (payload) => {
          const parsed = parseRallyPointRow(payload.new as Record<string, unknown>);
          if (!parsed) {
            return;
          }
          setRallyPoint((prev) => {
            if (!prev) {
              return null;
            }
            const missionChanged = parsed.activeMissionId !== prev.activeMissionId;
            if (missionChanged || parsed.hostUserId === undefined) {
              // rallyPoints row has no mission state; refetch so force-nav sees live
              // state. Also refetch when the payload omitted host_user_id — a
              // guest cannot read that column, and get_rally_point is SECURITY DEFINER
              // so it still returns who holds command.
              void refresh();
            }
            return {
              ...prev,
              ...parsed,
              members: prev.members,
              activeMissionState: missionChanged
                ? null
                : parsed.activeMissionState !== undefined
                  ? parsed.activeMissionState
                  : prev.activeMissionState,
            };
          });
        }
      );

      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rally_point_members',
          filter: `rally_point_id=eq.${rallyPointId}`,
        },
        () => {
          void refresh();
        }
      );
    }

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<{ member_id?: string; nickname?: string }>();
      const next: RallyPointPresenceByMemberId = {};
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
  }, [rallyPointId, presenceMemberId, presenceNickname, realtimeTables]);

  return {
    rallyPoint: rallyPointId ? rallyPoint : null,
    presenceByMemberId: rallyPointId ? presenceByMemberId : {},
    isConnected: Boolean(rallyPointId) && isConnected,
    error: rallyPointId ? error : null,
    refresh,
  };
}
