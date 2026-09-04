import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getMissionLiveState } from '@/lib/api/getMissionLiveState';
import { getSupabaseClient } from '@/lib/supabase';
import { track } from '@/lib/analytics/track';
import { getStoredClaimToken, getStoredHostToken } from '@/lib/missionIdentity';
import { LIVE_STATE_MESSAGE_CAP } from '@/lib/realtime/liveStateLimits';
import { nextLiveStateSince } from '@/lib/realtime/liveStateWatermark';
import {
  mergeMissionClock,
  mergePresenceState,
  parseMessageRow,
  parseParticipantRow,
  parseRoundRow,
  parseSegmentResultRow,
  parseMissionRow,
  removeSegmentResult,
  sortMessagesByCreatedAt,
  upsertMessage,
  upsertParticipant,
  upsertRound,
  upsertSegmentResult,
  type PresenceByParticipantId,
} from '@/lib/realtime/missionChannelUtils';
import type {
  MessageRow,
  ParticipantRow,
  ParticipantSegmentResultRow,
  RoundRow,
  MissionRow,
} from '@/lib/missionSync/types';

/** Guests cannot SELECT mission tables after Phase 2 RLS; poll get_mission_live_state. */
export const GUEST_MISSION_POLL_MS = 5_000;

export interface MissionChannelPresence {
  participantId: string;
  nickname: string;
}

export interface UseMissionChannelResult {
  mission: MissionRow | null;
  participants: ParticipantRow[];
  rounds: RoundRow[];
  segmentResults: ParticipantSegmentResultRow[];
  messages: MessageRow[];
  presenceByParticipantId: PresenceByParticipantId;
  isConnected: boolean;
  error: string | null;
}

export function useMissionChannel(
  missionId: string | undefined,
  presence: MissionChannelPresence | null,
  options?: { realtimeTables?: boolean }
): UseMissionChannelResult {
  const realtimeTables = options?.realtimeTables === true;
  const [mission, setMission] = useState<MissionRow | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [segmentResults, setSegmentResults] = useState<ParticipantSegmentResultRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [presenceByParticipantId, setPresenceByParticipantId] = useState<PresenceByParticipantId>(
    {}
  );
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const participantIdsRef = useRef<Set<string>>(new Set());
  const cancelledRef = useRef(false);
  const missionIdRef = useRef(missionId);
  const fetchGenRef = useRef(0);
  const sinceRef = useRef<string | null>(null);

  const presenceParticipantId = presence?.participantId;
  const presenceNickname = presence?.nickname;

  useEffect(() => {
    if (!missionId || !presenceParticipantId || !presenceNickname) {
      fetchGenRef.current += 1;
      return;
    }

    missionIdRef.current = missionId;
    sinceRef.current = null;
    const supabase = getSupabaseClient();
    cancelledRef.current = false;
    const participantIdForRpc = presenceParticipantId;

    async function refreshSnapshot() {
      const requestedMissionId = missionIdRef.current;
      if (!requestedMissionId) {
        return;
      }

      const genAtStart = fetchGenRef.current;
      const result = await getMissionLiveState({
        missionId: requestedMissionId,
        participantId: participantIdForRpc,
        claimToken: getStoredClaimToken(requestedMissionId),
        hostToken: getStoredHostToken(requestedMissionId),
        since: sinceRef.current,
      });

      if (cancelledRef.current || genAtStart !== fetchGenRef.current) {
        return;
      }

      if (!result.ok) {
        setError(result.error ?? result.reason);
        return;
      }

      setError(null);
      if (result.data.mission) {
        setMission(result.data.mission);
      } else if (result.data.missionClock) {
        const clock = result.data.missionClock;
        setMission((prev) => mergeMissionClock(prev, clock));
      }
      if (result.data.incremental) {
        setParticipants((prev) => {
          let next = result.data.participants.reduce(
            (roster, row) => upsertParticipant(roster, row),
            prev
          );
          if (result.data.participantIds) {
            const keep = new Set(result.data.participantIds);
            next = next.filter((row) => keep.has(row.id));
          }
          participantIdsRef.current = new Set(next.map((row) => row.id));
          return next;
        });
        setRounds((prev) => result.data.rounds.reduce((next, row) => upsertRound(next, row), prev));
        setMessages((prev) =>
          sortMessagesByCreatedAt(
            result.data.messages.reduce((next, row) => upsertMessage(next, row), prev)
          ).slice(-LIVE_STATE_MESSAGE_CAP)
        );
        setSegmentResults((prev) =>
          result.data.segmentResults.reduce((next, row) => upsertSegmentResult(next, row), prev)
        );
      } else {
        setParticipants(result.data.participants);
        participantIdsRef.current = new Set(result.data.participants.map((row) => row.id));
        setRounds(result.data.rounds);
        setMessages(sortMessagesByCreatedAt(result.data.messages));
        setSegmentResults(result.data.segmentResults);
      }
      sinceRef.current = nextLiveStateSince({
        previous: sinceRef.current,
        rounds: result.data.rounds,
        messages: result.data.messages,
        segmentResults: result.data.segmentResults,
        snapshotAt: result.data.snapshotAt,
      });
    }

    // Snapshot load; setState only after await inside refreshSnapshot.
    void refreshSnapshot();

    let pollTimer: number | null = null;
    if (!realtimeTables) {
      pollTimer = window.setInterval(() => {
        void refreshSnapshot();
      }, GUEST_MISSION_POLL_MS);
    }

    const channel = supabase.channel(`mission:${missionId}`, {
      config: { presence: { key: presenceParticipantId } },
    });
    const subscribeStartedAtMs = Date.now();

    if (realtimeTables) {
      channel
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'missions',
            filter: `id=eq.${missionId}`,
          },
          (payload) => {
            const parsed = parseMissionRow(payload.new as Record<string, unknown>);
            if (parsed) {
              setMission(parsed);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'participants',
            filter: `mission_id=eq.${missionId}`,
          },
          (payload) => {
            const parsed = parseParticipantRow(payload.new as Record<string, unknown>);
            if (parsed) {
              participantIdsRef.current.add(parsed.id);
              setParticipants((prev) => upsertParticipant(prev, parsed));
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'participant_segment_results',
            filter: `mission_id=eq.${missionId}`,
          },
          (payload) => {
            if (payload.eventType === 'DELETE') {
              const oldRecord = payload.old as Record<string, unknown>;
              const participantId =
                typeof oldRecord.participant_id === 'string' ? oldRecord.participant_id : null;
              const segmentIndex =
                typeof oldRecord.segment_index === 'number' ? oldRecord.segment_index : null;

              if (
                !participantId ||
                segmentIndex === null ||
                !participantIdsRef.current.has(participantId)
              ) {
                return;
              }

              setSegmentResults((prev) => removeSegmentResult(prev, participantId, segmentIndex));
              return;
            }

            const parsed = parseSegmentResultRow(payload.new as Record<string, unknown>);
            if (parsed && participantIdsRef.current.has(parsed.participant_id)) {
              setSegmentResults((prev) => upsertSegmentResult(prev, parsed));
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'rounds',
            filter: `mission_id=eq.${missionId}`,
          },
          (payload) => {
            const parsed = parseRoundRow(payload.new as Record<string, unknown>);
            if (parsed) {
              setRounds((prev) => upsertRound(prev, parsed));
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `mission_id=eq.${missionId}`,
          },
          (payload) => {
            const parsed = parseMessageRow(payload.new as Record<string, unknown>);
            if (parsed) {
              setMessages((prev) => sortMessagesByCreatedAt(upsertMessage(prev, parsed)));
            }
          }
        );
    }

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setPresenceByParticipantId(mergePresenceState(state));
      })
      .on('presence', { event: 'join' }, () => {
        const state = channel.presenceState();
        setPresenceByParticipantId(mergePresenceState(state));
      })
      .on('presence', { event: 'leave' }, () => {
        const state = channel.presenceState();
        setPresenceByParticipantId(mergePresenceState(state));
      })
      .subscribe(async (status) => {
        track(
          'realtime_status',
          {
            status,
            latency_ms: status === 'SUBSCRIBED' ? Date.now() - subscribeStartedAtMs : null,
          },
          { missionId }
        );

        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          await channel.track({
            participant_id: presenceParticipantId,
            nickname: presenceNickname,
          });
        } else if (status === 'CHANNEL_ERROR') {
          setError('Realtime connection failed.');
          setIsConnected(false);
        } else if (status === 'TIMED_OUT' || status === 'CLOSED') {
          setIsConnected(false);
        }
      });

    channelRef.current = channel;

    return () => {
      cancelledRef.current = true;
      fetchGenRef.current += 1;
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [missionId, presenceParticipantId, presenceNickname, realtimeTables]);

  return {
    mission,
    participants,
    rounds,
    segmentResults,
    messages,
    presenceByParticipantId,
    isConnected,
    error,
  };
}
