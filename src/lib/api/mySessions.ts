import { supabase } from '@/lib/supabase';
import type { WorkoutExercise } from '@/lib/api/sessionTypes';
import type { ScoreBreakdown } from '@/lib/scoring/types';
import { computeBaseScore } from '@/lib/scoring/computeBaseScore';
import { computeRepsPerRound } from '@/lib/scoring/computeRepsPerRound';

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
  partialReps: number;
  finalScore: number | null;
  scoreBreakdown: ScoreBreakdown | null;
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

export function computeMySessionBaseScore(entry: MySessionEntry): number {
  try {
    const repsPerRound = computeRepsPerRound(entry.workout);
    return computeBaseScore(entry.roundCount, entry.partialReps, repsPerRound);
  } catch {
    // Copilot suggestion ignored: roundCount fallback is intentional; callers use formatMySessionScoreDisplay for the unit label.
    return entry.roundCount;
  }
}

export function isMySessionScoreScorable(entry: MySessionEntry): boolean {
  try {
    computeRepsPerRound(entry.workout);
    return true;
  } catch {
    return false;
  }
}

export function formatMySessionScoreDisplay(entry: MySessionEntry): string {
  if (entry.finalScore !== null) {
    return `${entry.finalScore} reps`;
  }

  if (!isMySessionScoreScorable(entry)) {
    return `${entry.roundCount} rounds`;
  }

  return `${computeMySessionBaseScore(entry)} reps`;
}

export function displayMySessionScore(entry: MySessionEntry): string | number {
  if (entry.finalScore !== null) {
    return entry.finalScore;
  }

  const baseScore = computeMySessionBaseScore(entry);
  return baseScore ?? 'N/A';
}

function readScoreBreakdown(value: unknown): ScoreBreakdown | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const baseScore = readNumber(row.baseScore);
  const pviMultiplier = readNumber(row.pviMultiplier);
  const domainWeight = readNumber(row.domainWeight);
  const finalScore = readNumber(row.finalScore);
  const pviRaw = row.pvi;

  if (
    baseScore === null ||
    pviMultiplier === null ||
    domainWeight === null ||
    finalScore === null
  ) {
    return null;
  }

  const pvi =
    pviRaw === null || pviRaw === undefined ? null : readNumber(pviRaw);

  if (pviRaw !== null && pviRaw !== undefined && pvi === null) {
    return null;
  }

  return {
    baseScore,
    pvi,
    pviMultiplier,
    domainWeight,
    finalScore,
  };
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
  const partialReps = readNumber(row.partial_reps) ?? 0;
  const finalScore =
    row.final_score === null || row.final_score === undefined
      ? null
      : readNumber(row.final_score);
  const scoreBreakdown =
    row.score_breakdown === null || row.score_breakdown === undefined
      ? null
      : readScoreBreakdown(row.score_breakdown);

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
    partialReps,
    finalScore,
    scoreBreakdown,
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
