import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';
import { track } from '@/lib/analytics/track';
import {
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
  presence: MissionChannelPresence | null
): UseMissionChannelResult {
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

  const presenceParticipantId = presence?.participantId;
  const presenceNickname = presence?.nickname;

  useEffect(() => {
    if (!missionId || !presenceParticipantId || !presenceNickname) {
      return;
    }

    const supabase = getSupabaseClient();
    let cancelled = false;

    async function loadInitial() {
      const [missionResult, participantsResult, roundsResult, messagesResult] = await Promise.all([
        supabase
          .from('missions')
          .select(
            'id, duration_minutes, workout, template_id, state, time_left_sec, is_paused, started_at, scheduled_at, rally_point_countdown_ends_at, segment_index, created_at, is_featured, rally_point_id'
          )
          .eq('id', missionId)
          .maybeSingle(),
        supabase
          .from('participants')
          .select('id, mission_id, nickname, role, joined_at')
          .eq('mission_id', missionId),
        supabase
          .from('rounds')
          .select(
            'id, mission_id, participant_id, round_index, elapsed_sec_at_round, segment_index, created_at'
          )
          .eq('mission_id', missionId),
        supabase
          .from('messages')
          .select('id, mission_id, participant_id, nickname, body, segment_index, created_at')
          .eq('mission_id', missionId)
          .order('created_at', { ascending: true }),
      ]);

      if (cancelled) {
        return;
      }

      if (missionResult.error) {
        setError(missionResult.error.message);
        return;
      }

      if (participantsResult.error) {
        setError(participantsResult.error.message);
        return;
      }

      if (roundsResult.error) {
        setError(roundsResult.error.message);
        return;
      }

      if (messagesResult.error) {
        setError(messagesResult.error.message);
        return;
      }

      setError(null);

      if (missionResult.data) {
        const parsed = parseMissionRow(missionResult.data as Record<string, unknown>);
        if (parsed) {
          setMission(parsed);
        }
      }

      const parsedParticipants = (participantsResult.data ?? [])
        .map((row) => parseParticipantRow(row as Record<string, unknown>))
        .filter((row): row is ParticipantRow => row !== null);
      setParticipants(parsedParticipants);
      participantIdsRef.current = new Set(parsedParticipants.map((participant) => participant.id));

      const participantIds = parsedParticipants.map((participant) => participant.id);
      if (participantIds.length > 0) {
        const segmentResultsResult = await supabase
          .from('participant_segment_results')
          .select(
            'participant_id, segment_index, partial_reps, final_score, score_breakdown, updated_at'
          )
          .in('participant_id', participantIds);

        if (cancelled) {
          return;
        }

        if (segmentResultsResult.error) {
          setError(segmentResultsResult.error.message);
          return;
        }

        const parsedSegmentResults = (segmentResultsResult.data ?? [])
          .map((row) => parseSegmentResultRow(row as Record<string, unknown>))
          .filter((row): row is ParticipantSegmentResultRow => row !== null);
        setSegmentResults((prev) => {
          let merged = prev;
          for (const row of parsedSegmentResults) {
            merged = upsertSegmentResult(merged, row);
          }
          return merged;
        });
      } else {
        setSegmentResults([]);
      }

      const parsedRounds = (roundsResult.data ?? [])
        .map((row) => parseRoundRow(row as Record<string, unknown>))
        .filter((row): row is RoundRow => row !== null);
      setRounds(parsedRounds);

      const parsedMessages = sortMessagesByCreatedAt(
        (messagesResult.data ?? [])
          .map((row) => parseMessageRow(row as Record<string, unknown>))
          .filter((row): row is MessageRow => row !== null)
      );
      setMessages(parsedMessages);
    }

    loadInitial();

    const channel = supabase.channel(`mission:${missionId}`, {
      config: { presence: { key: presenceParticipantId } },
    });
    const subscribeStartedAtMs = Date.now();

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
      )
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
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [missionId, presenceParticipantId, presenceNickname]);

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
