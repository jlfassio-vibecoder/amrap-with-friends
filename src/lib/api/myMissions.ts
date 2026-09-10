import { callRpc } from '@/lib/api/callRpc';
import { readModifiedMovements } from '@/lib/mission/modifiedMovements';
import { readMovementVariants } from '@/lib/mission/exerciseScaling';
import {
  readCheckIns,
  readRpe,
  readSessionNotes,
  type MissionCheckIns,
} from '@/lib/mission/missionCheckIn';
import type { WorkoutExercise } from '@/lib/api/missionTypes';
import type { ScoreBreakdown } from '@/lib/scoring/types';
import { parseScoreBreakdownJson } from '@/lib/scoring/parseScoreBreakdownJson';
import { computeBaseScore } from '@/lib/scoring/computeBaseScore';
import { computeRepsPerRound } from '@/lib/scoring/computeRepsPerRound';
import { resolveWorkoutTitle } from '@/lib/workout/resolveWorkoutTitle';
import { formatMissionStateLabel } from '@/lib/mission/formatMissionStateLabel';
import { countOf } from '@/lib/units/plural';

export interface MyMissionEntry {
  participantId: string;
  nickname: string;
  joinedAt: string;
  role: 'host' | 'joiner';
  missionId: string;
  createdAt: string;
  /** Featured occurrence start; prefer over createdAt for display when set. */
  scheduledAt: string | null;
  isFeatured: boolean;
  durationMinutes: number;
  workout: WorkoutExercise[];
  /** Library or coach template id when the mission was created from one. */
  templateId: string | null;
  /** Shared Next Mission hub; null for guest-only / non-hub missions. */
  rallyPointId: string | null;
  /** Rows in mission_chain_items for this hub; 0 when none / no hub. */
  chainItemCount: number;
  /** Unstarted chain slots still waiting to be created. */
  chainUnstartedCount: number;
  state: string;
  segmentIndex: number;
  roundCount: number;
  partialReps: number;
  finalScore: number | null;
  scoreBreakdown: ScoreBreakdown | null;
  /** Empty when the mission was performed as programmed. */
  modifiedMovements: string[];
  /** `{ movement name: scaling option id }` for any scaling the athlete named. */
  movementVariants: Record<string, string>;
  /** Optional session RPE 1–10. */
  rpe: number | null;
  /** Optional free-text notes. */
  sessionNotes: string;
  /** Optional structured check-in chips. */
  checkIns: MissionCheckIns;
  coachWorkoutName: string | null;
}

/** Card title: coach name wins, then library template name, else "Workout". */
export function myMissionWorkoutTitle(entry: MyMissionEntry): string {
  if (entry.coachWorkoutName) {
    return entry.coachWorkoutName;
  }
  return resolveWorkoutTitle(entry.templateId);
}

export type MyMissionsApiError = {
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

export function computeMyMissionBaseScore(entry: MyMissionEntry): number {
  try {
    const repsPerRound = computeRepsPerRound(entry.workout);
    return computeBaseScore(entry.roundCount, entry.partialReps, repsPerRound);
  } catch {
    // Copilot suggestion ignored: roundCount fallback is intentional; callers use formatMyMissionScoreDisplay for the unit label.
    return entry.roundCount;
  }
}

export function isMyMissionScoreScorable(entry: MyMissionEntry): boolean {
  try {
    computeRepsPerRound(entry.workout);
    return true;
  } catch {
    return false;
  }
}

/** 0 for a workout `computeRepsPerRound` cannot total — a round-based mission. */
export function getMyMissionRepsPerRound(entry: MyMissionEntry): number {
  try {
    return computeRepsPerRound(entry.workout);
  } catch {
    return 0;
  }
}

export function formatMyMissionScoreDisplay(entry: MyMissionEntry): string {
  // Always the reps (or rounds) actually done — never entry.finalScore, which
  // is baseScore adjusted by P.V.I. and Domain and reads as a different total
  // than what the athlete performed. That used to be the value shown here
  // for every finished mission, reps-countable or not, unconditionally
  // labelled "reps" even for a round-based workout.
  if (!isMyMissionScoreScorable(entry)) {
    return countOf(entry.roundCount, 'round');
  }

  return `${computeMyMissionBaseScore(entry)} reps`;
}

export function formatMyMissionExerciseLine(exercise: WorkoutExercise): string {
  if (exercise.target === undefined) {
    return exercise.name;
  }
  return `${exercise.name} — ${exercise.target}${exercise.unit ? ` ${exercise.unit}` : ''}`;
}

/** Plain-text card summary for Web Share / clipboard (title, movements, meta). */
export function formatMyMissionShareText(entry: MyMissionEntry): string {
  const title = myMissionWorkoutTitle(entry);
  const when = entry.scheduledAt ?? entry.createdAt;
  const meta = [
    new Date(when).toLocaleString(),
    `${entry.durationMinutes} min`,
    formatMyMissionScoreDisplay(entry),
    formatMissionStateLabel(entry.state),
    ...(entry.isFeatured ? ['Featured'] : []),
  ].join(' · ');

  if (entry.workout.length === 0) {
    return `${title}\n\n${meta}`;
  }

  const movements = entry.workout.map(formatMyMissionExerciseLine).join('\n');
  return `${title}\n\n${movements}\n\n${meta}`;
}

export function canDeleteMyMission(entry: MyMissionEntry): boolean {
  return entry.role === 'host' && entry.scoreBreakdown === null && entry.state !== 'finished';
}

export function displayMyMissionScore(entry: MyMissionEntry): string | number {
  if (entry.finalScore !== null) {
    return entry.finalScore;
  }

  const baseScore = computeMyMissionBaseScore(entry);
  return baseScore ?? 'N/A';
}

function readScoreBreakdown(value: unknown): ScoreBreakdown | null {
  return parseScoreBreakdownJson(value);
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

function parseMyMissionEntry(raw: unknown): MyMissionEntry | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const row = raw as Record<string, unknown>;
  const participantId = readString(row.participant_id);
  const nickname = readString(row.nickname);
  const joinedAt = readString(row.joined_at);
  const role = row.role === 'host' || row.role === 'joiner' ? row.role : null;
  const missionId = readString(row.mission_id);
  const createdAt = readString(row.created_at);
  const durationMinutes = readNumber(row.duration_minutes);
  const state = readString(row.state);
  const segmentIndex = readNumber(row.segment_index) ?? 0;
  const roundCount = readNumber(row.round_count) ?? 0;
  const partialReps = readNumber(row.partial_reps) ?? 0;
  const finalScore =
    row.final_score === null || row.final_score === undefined ? null : readNumber(row.final_score);
  const scoreBreakdown =
    row.score_breakdown === null || row.score_breakdown === undefined
      ? null
      : readScoreBreakdown(row.score_breakdown);

  if (
    !participantId ||
    !nickname ||
    !joinedAt ||
    !role ||
    !missionId ||
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
    missionId,
    createdAt,
    scheduledAt: readString(row.scheduled_at),
    isFeatured: row.is_featured === true,
    durationMinutes,
    workout: readWorkout(row.workout),
    templateId: readString(row.template_id),
    rallyPointId: readString(row.rally_point_id),
    modifiedMovements: readModifiedMovements(row.modified_movements),
    movementVariants: readMovementVariants(row.movement_variants),
    rpe: readRpe(row.rpe),
    sessionNotes: readSessionNotes(row.session_notes),
    checkIns: readCheckIns(row.check_ins),
    chainItemCount: readNumber(row.chain_item_count) ?? 0,
    chainUnstartedCount: readNumber(row.chain_unstarted_count) ?? 0,
    state,
    segmentIndex,
    roundCount,
    partialReps,
    finalScore,
    scoreBreakdown,
    coachWorkoutName: readString(row.coach_workout_name),
  };
}

export async function fetchMyMissions(): Promise<{
  data: MyMissionEntry[] | null;
  error: MyMissionsApiError | null;
}> {
  const { data, error } = await callRpc('my_missions');

  if (error) {
    return { data: null, error: { message: error.message } };
  }

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

  if (raw.ok !== true) {
    return {
      data: null,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  const missions = Array.isArray(raw.missions) ? raw.missions : [];
  const entries = missions
    .map((mission) => parseMyMissionEntry(mission))
    .filter((entry): entry is MyMissionEntry => entry !== null);

  return { data: entries, error: null };
}

function mapDeleteError(message: string | undefined): string {
  if (!message) {
    return 'Something went wrong. Please try again.';
  }
  if (message.includes('Authentication required')) {
    return 'Sign in to delete this mission.';
  }
  if (message.includes('Only the host can delete')) {
    return 'Only the host can delete this mission.';
  }
  if (message.includes('Completed missions cannot be deleted')) {
    return 'Completed missions cannot be deleted.';
  }
  if (message.includes('Mission not found')) {
    return 'Mission not found.';
  }
  return message;
}

export async function deleteIncompleteMission(
  missionId: string
): Promise<{ error: MyMissionsApiError | null }> {
  const { data, error } = await callRpc('delete_incomplete_mission', {
    p_mission_id: missionId,
  });

  if (error) {
    return { error: { message: mapDeleteError(error.message) } };
  }

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

  if (raw.ok !== true) {
    return {
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  return { error: null };
}
