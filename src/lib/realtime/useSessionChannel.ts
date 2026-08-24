import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';
import {
  mergePresenceState,
  parseMessageRow,
  parseParticipantRow,
  parseRoundRow,
  parseSegmentResultRow,
  parseSessionRow,
  sortMessagesByCreatedAt,
  upsertMessage,
  upsertParticipant,
  upsertRound,
  upsertSegmentResult,
  type PresenceByParticipantId,
} from '@/lib/realtime/sessionChannelUtils';
import type {
  MessageRow,
  ParticipantRow,
  ParticipantSegmentResultRow,
  RoundRow,
  SessionRow,
} from '@/lib/sessionSync/types';

export interface SessionChannelPresence {
  participantId: string;
  nickname: string;
}

export interface UseSessionChannelResult {
  session: SessionRow | null;
  participants: ParticipantRow[];
  rounds: RoundRow[];
  segmentResults: ParticipantSegmentResultRow[];
  messages: MessageRow[];
  presenceByParticipantId: PresenceByParticipantId;
  isConnected: boolean;
  error: string | null;
}

export function useSessionChannel(
  sessionId: string | undefined,
  presence: SessionChannelPresence | null
): UseSessionChannelResult {
  const [session, setSession] = useState<SessionRow | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [segmentResults, setSegmentResults] = useState<ParticipantSegmentResultRow[]>(
    []
  );
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [presenceByParticipantId, setPresenceByParticipantId] =
    useState<PresenceByParticipantId>({});
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const presenceParticipantId = presence?.participantId;
  const presenceNickname = presence?.nickname;

  useEffect(() => {
    if (!sessionId || !presenceParticipantId || !presenceNickname) {
      return;
    }

    const supabase = getSupabaseClient();
    let cancelled = false;

    async function loadInitial() {
      const [sessionResult, participantsResult, roundsResult, messagesResult] =
        await Promise.all([
        supabase
          .from('sessions')
          .select(
            'id, duration_minutes, workout, state, time_left_sec, is_paused, started_at, segment_index, created_at'
          )
          .eq('id', sessionId)
          .maybeSingle(),
        supabase
          .from('participants')
          .select('id, session_id, nickname, role, joined_at')
          .eq('session_id', sessionId),
        supabase
          .from('rounds')
          .select(
            'id, session_id, participant_id, round_index, elapsed_sec_at_round, segment_index, created_at'
          )
          .eq('session_id', sessionId),
        supabase
          .from('messages')
          .select(
            'id, session_id, participant_id, nickname, body, segment_index, created_at'
          )
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true }),
      ]);

      if (cancelled) {
        return;
      }

      if (sessionResult.error) {
        setError(sessionResult.error.message);
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

      if (sessionResult.data) {
        const parsed = parseSessionRow(sessionResult.data as Record<string, unknown>);
        if (parsed) {
          setSession(parsed);
        }
      }

      const parsedParticipants = (participantsResult.data ?? [])
        .map((row) => parseParticipantRow(row as Record<string, unknown>))
        .filter((row): row is ParticipantRow => row !== null);
      setParticipants(parsedParticipants);

      const participantIds = parsedParticipants.map((participant) => participant.id);
      if (participantIds.length > 0) {
        const segmentResultsResult = await supabase
          .from('participant_segment_results')
          .select('participant_id, segment_index, partial_reps, updated_at')
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
        setSegmentResults(parsedSegmentResults);
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

    const channel = supabase.channel(`session:${sessionId}`, {
      config: { presence: { key: presenceParticipantId } },
    });

    channel
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const parsed = parseSessionRow(
            payload.new as Record<string, unknown>
          );
          if (parsed) {
            setSession(parsed);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'participants',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const parsed = parseParticipantRow(
            payload.new as Record<string, unknown>
          );
          if (parsed) {
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
          const record =
            payload.eventType === 'DELETE'
              ? (payload.old as Record<string, unknown>)
              : (payload.new as Record<string, unknown>);
          const parsed = parseSegmentResultRow(record);
          if (parsed) {
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
          filter: `session_id=eq.${sessionId}`,
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
          filter: `session_id=eq.${sessionId}`,
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
  }, [sessionId, presenceParticipantId, presenceNickname]);

  return {
    session,
    participants,
    rounds,
    segmentResults,
    messages,
    presenceByParticipantId,
    isConnected,
    error,
  };
}
