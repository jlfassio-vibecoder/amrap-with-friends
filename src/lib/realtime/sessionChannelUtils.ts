import type { ParticipantRow, RoundRow, SessionRow, MessageRow } from '@/lib/sessionSync/types';

export interface PresenceTrackPayload {
  participant_id: string;
  nickname: string;
}

export interface PresenceByParticipantId {
  [participantId: string]: { nickname: string };
}

export function parseSessionRow(record: Record<string, unknown>): SessionRow | null {
  const id = typeof record.id === 'string' ? record.id : null;
  const durationMinutes =
    typeof record.duration_minutes === 'number' ? record.duration_minutes : null;
  const state = typeof record.state === 'string' ? record.state : null;
  const timeLeftSec =
    typeof record.time_left_sec === 'number' ? record.time_left_sec : null;
  const isPaused = typeof record.is_paused === 'boolean' ? record.is_paused : null;
  const segmentIndex =
    typeof record.segment_index === 'number' ? record.segment_index : null;
  const createdAt = typeof record.created_at === 'string' ? record.created_at : null;
  const workout = record.workout;

  if (
    !id ||
    durationMinutes === null ||
    !state ||
    timeLeftSec === null ||
    isPaused === null ||
    segmentIndex === null ||
    !createdAt ||
    !Array.isArray(workout)
  ) {
    return null;
  }

  if (
    state !== 'waiting' &&
    state !== 'setup' &&
    state !== 'work' &&
    state !== 'finished'
  ) {
    return null;
  }

  const startedAt =
    record.started_at === null || record.started_at === undefined
      ? null
      : String(record.started_at);

  return {
    id,
    duration_minutes: durationMinutes,
    workout: workout as SessionRow['workout'],
    state,
    time_left_sec: timeLeftSec,
    is_paused: isPaused,
    started_at: startedAt,
    segment_index: segmentIndex,
    created_at: createdAt,
  };
}

export function parseParticipantRow(
  record: Record<string, unknown>
): ParticipantRow | null {
  const id = typeof record.id === 'string' ? record.id : null;
  const sessionId = typeof record.session_id === 'string' ? record.session_id : null;
  const nickname = typeof record.nickname === 'string' ? record.nickname : null;
  const role = typeof record.role === 'string' ? record.role : null;
  const joinedAt = typeof record.joined_at === 'string' ? record.joined_at : null;

  if (!id || !sessionId || !nickname || !joinedAt) {
    return null;
  }

  if (role !== 'host' && role !== 'joiner') {
    return null;
  }

  return {
    id,
    session_id: sessionId,
    nickname,
    role,
    joined_at: joinedAt,
  };
}

export function parseRoundRow(record: Record<string, unknown>): RoundRow | null {
  const id = typeof record.id === 'string' ? record.id : null;
  const sessionId = typeof record.session_id === 'string' ? record.session_id : null;
  const participantId =
    typeof record.participant_id === 'string' ? record.participant_id : null;
  const roundIndex =
    typeof record.round_index === 'number' ? record.round_index : null;
  const elapsedSecAtRound =
    typeof record.elapsed_sec_at_round === 'number'
      ? record.elapsed_sec_at_round
      : null;
  const segmentIndex =
    typeof record.segment_index === 'number' ? record.segment_index : null;
  const createdAt = typeof record.created_at === 'string' ? record.created_at : null;

  if (
    !id ||
    !sessionId ||
    !participantId ||
    roundIndex === null ||
    elapsedSecAtRound === null ||
    segmentIndex === null ||
    !createdAt
  ) {
    return null;
  }

  return {
    id,
    session_id: sessionId,
    participant_id: participantId,
    round_index: roundIndex,
    elapsed_sec_at_round: elapsedSecAtRound,
    segment_index: segmentIndex,
    created_at: createdAt,
  };
}

export function parseMessageRow(record: Record<string, unknown>): MessageRow | null {
  const id = typeof record.id === 'string' ? record.id : null;
  const sessionId = typeof record.session_id === 'string' ? record.session_id : null;
  const participantId =
    typeof record.participant_id === 'string' ? record.participant_id : null;
  const nickname = typeof record.nickname === 'string' ? record.nickname : null;
  const body = typeof record.body === 'string' ? record.body : null;
  const segmentIndex =
    typeof record.segment_index === 'number' ? record.segment_index : null;
  const createdAt = typeof record.created_at === 'string' ? record.created_at : null;

  if (
    !id ||
    !sessionId ||
    !participantId ||
    !nickname ||
    !body ||
    segmentIndex === null ||
    !createdAt
  ) {
    return null;
  }

  return {
    id,
    session_id: sessionId,
    participant_id: participantId,
    nickname,
    body,
    segment_index: segmentIndex,
    created_at: createdAt,
  };
}

export function mergePresenceState(
  presenceState: Record<string, unknown>
): PresenceByParticipantId {
  const merged: PresenceByParticipantId = {};

  for (const key of Object.keys(presenceState)) {
    const metas = presenceState[key];
    if (!Array.isArray(metas)) {
      continue;
    }

    for (const meta of metas) {
      if (!meta || typeof meta !== 'object') {
        continue;
      }
      const record = meta as Record<string, unknown>;
      const participantId =
        typeof record.participant_id === 'string' ? record.participant_id : null;
      const nickname = typeof record.nickname === 'string' ? record.nickname : null;
      if (participantId && nickname) {
        merged[participantId] = { nickname };
      }
    }
  }

  return merged;
}

export function upsertParticipant(
  participants: ParticipantRow[],
  row: ParticipantRow
): ParticipantRow[] {
  const existing = participants.find((p) => p.id === row.id);
  if (existing) {
    return participants.map((p) => (p.id === row.id ? row : p));
  }
  return [...participants, row];
}

export function upsertRound(rounds: RoundRow[], row: RoundRow): RoundRow[] {
  const existing = rounds.find((r) => r.id === row.id);
  if (existing) {
    return rounds.map((r) => (r.id === row.id ? row : r));
  }
  return [...rounds, row];
}

export function upsertMessage(messages: MessageRow[], row: MessageRow): MessageRow[] {
  const existing = messages.find((m) => m.id === row.id);
  if (existing) {
    return messages.map((m) => (m.id === row.id ? row : m));
  }
  return [...messages, row];
}

export function sortMessagesByCreatedAt(messages: MessageRow[]): MessageRow[] {
  return [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function buildLeaderboard(
  participants: ParticipantRow[],
  rounds: RoundRow[],
  segmentIndex: number,
  selfParticipantId: string
): Array<{
  participantId: string;
  nickname: string;
  roundCount: number;
  isSelf: boolean;
}> {
  const counts = new Map<string, number>();

  for (const round of rounds) {
    if (round.segment_index !== segmentIndex) {
      continue;
    }
    counts.set(round.participant_id, (counts.get(round.participant_id) ?? 0) + 1);
  }

  return participants
    .map((participant) => ({
      participantId: participant.id,
      nickname: participant.nickname,
      roundCount: counts.get(participant.id) ?? 0,
      isSelf: participant.id === selfParticipantId,
    }))
    .sort((a, b) => {
      if (b.roundCount !== a.roundCount) {
        return b.roundCount - a.roundCount;
      }
      return a.nickname.localeCompare(b.nickname);
    });
}

export function buildPresenceList(
  participants: ParticipantRow[],
  presenceByParticipantId: PresenceByParticipantId
): Array<{
  participantId: string;
  nickname: string;
  isOnline: boolean;
}> {
  return participants.map((participant) => ({
    participantId: participant.id,
    nickname: participant.nickname,
    isOnline: presenceByParticipantId[participant.id] !== undefined,
  }));
}
