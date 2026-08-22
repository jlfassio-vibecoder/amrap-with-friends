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

export async function fetchMySessions(userId: string): Promise<{
  data: MySessionEntry[] | null;
  error: MySessionsApiError | null;
}> {
  const { data, error } = await supabase
    .from('participants')
    .select(
      `
      id,
      nickname,
      joined_at,
      role,
      session_id,
      sessions (
        id,
        created_at,
        duration_minutes,
        workout,
        state,
        segment_index
      ),
      rounds ( id, segment_index )
    `
    )
    .eq('user_id', userId)
    .order('joined_at', { ascending: false });

  if (error) {
    return { data: null, error: { message: error.message } };
  }

  const entries: MySessionEntry[] = [];

  for (const row of data ?? []) {
    const sessionRaw = row.sessions;
    const session =
      sessionRaw && typeof sessionRaw === 'object' && !Array.isArray(sessionRaw)
        ? sessionRaw
        : Array.isArray(sessionRaw)
          ? sessionRaw[0]
          : null;

    if (!session || typeof session !== 'object') {
      continue;
    }

    const sessionRecord = session as Record<string, unknown>;
    const sessionId = typeof sessionRecord.id === 'string' ? sessionRecord.id : null;
    const createdAt =
      typeof sessionRecord.created_at === 'string' ? sessionRecord.created_at : null;
    const durationMinutes =
      typeof sessionRecord.duration_minutes === 'number'
        ? sessionRecord.duration_minutes
        : null;
    const state = typeof sessionRecord.state === 'string' ? sessionRecord.state : null;
    const segmentIndex =
      typeof sessionRecord.segment_index === 'number'
        ? sessionRecord.segment_index
        : 0;

    if (!sessionId || !createdAt || durationMinutes === null || !state) {
      continue;
    }

    const rounds = Array.isArray(row.rounds)
      ? (row.rounds as Array<{ segment_index: number }>)
      : [];

    entries.push({
      participantId: row.id,
      nickname: row.nickname,
      joinedAt: row.joined_at,
      role: row.role,
      sessionId,
      createdAt,
      durationMinutes,
      workout: readWorkout(sessionRecord.workout),
      state,
      segmentIndex,
      roundCount: countRoundsForSegment(rounds, segmentIndex),
    });
  }

  return { data: entries, error: null };
}
