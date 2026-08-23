import { supabase } from '@/lib/supabase';
import type { WorkoutExercise } from '@/lib/api/sessionTypes';

export interface MySessionEntry {
  participantId: string;
  nickname: string;
  joinedAt: string;
  role: 'host' | 'joiner';
  sessionId: string;
  createdAt: string;
  durationMinutes: number;
  workout: WorkoutExercise[];
  state: string;
  segmentIndex: number;
  roundCount: number;
}

export type MySessionsApiError = {
  message: string;
};

function readWorkout(value: unknown): WorkoutExercise[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value as WorkoutExercise[];
}

export function countRoundsForSegment(
  rounds: Array<{ segment_index: number }>,
  segmentIndex: number
): number {
  return rounds.filter((round) => round.segment_index === segmentIndex).length;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseMySessionEntry(raw: unknown): MySessionEntry | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const row = raw as Record<string, unknown>;
  const participantId = readString(row.participant_id);
  const nickname = readString(row.nickname);
  const joinedAt = readString(row.joined_at);
  const role = row.role === 'host' || row.role === 'joiner' ? row.role : null;
  const sessionId = readString(row.session_id);
  const createdAt = readString(row.created_at);
  const durationMinutes = readNumber(row.duration_minutes);
  const state = readString(row.state);
  const segmentIndex = readNumber(row.segment_index) ?? 0;
  const roundCount = readNumber(row.round_count) ?? 0;

  if (
    !participantId ||
    !nickname ||
    !joinedAt ||
    !role ||
    !sessionId ||
    !createdAt ||
    durationMinutes === null ||
    !state
  ) {
    return null;
  }

  return {
    participantId,
    nickname,
    joinedAt,
    role,
    sessionId,
    createdAt,
    durationMinutes,
    workout: readWorkout(row.workout),
    state,
    segmentIndex,
    roundCount,
  };
}

export async function fetchMySessions(): Promise<{
  data: MySessionEntry[] | null;
  error: MySessionsApiError | null;
}> {
  const { data, error } = await supabase.rpc('my_sessions');

  if (error) {
    return { data: null, error: { message: error.message } };
  }

  const raw =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

  if (raw.ok !== true) {
    return {
      data: null,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  const sessions = Array.isArray(raw.sessions) ? raw.sessions : [];
  const entries = sessions
    .map((session) => parseMySessionEntry(session))
    .filter((entry): entry is MySessionEntry => entry !== null);

  return { data: entries, error: null };
}
