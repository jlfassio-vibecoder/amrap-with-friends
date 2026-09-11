import { callRpc } from '@/lib/api/callRpc';
import { readModifiedMovements } from '@/lib/mission/modifiedMovements';
import { readMovementVariants } from '@/lib/mission/exerciseScaling';
import {
  readCheckIns,
  readRpe,
  readSessionNotes,
  type MissionCheckIns,
} from '@/lib/mission/missionCheckIn';
import type { MissionChainItem } from '@/lib/api/missionChain';
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
  /**
   * Empty until hydrated via `fetchMyMissionDetail`. List rows use
   * `movementCount` / `repsPerRound` instead.
   */
  workout: WorkoutExercise[];
  /** Closed-card movement summary when workout is not yet loaded. */
  movementCount: number;
  /**
   * Scorable reps (or seconds) per round from the list RPC; null means
   * round-based. Prefer recomputing from `workout` once hydrated.
   */
  repsPerRound: number | null;
  /** Library or coach template id when the mission was created from one. */
  templateId: string | null;
  /**
   * Null until hydrated via `fetchMyMissionDetail`. List rows omit it so
   * Re-launch must load detail (or fall back to a library template).
   */
  intensityTier: number | null;
  /** Shared Next Mission hub; null for guest-only / non-hub missions. */
  rallyPointId: string | null;
  state: string;
  segmentIndex: number;
  roundCount: number;
  partialReps: number;
  finalScore: number | null;
  /** True when a locked breakdown exists; full object may still be null until hydrate. */
  hasScoreBreakdown: boolean;
  /** Null on slim list rows until `fetchMyMissionDetail`. */
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

export type MyMissionsListResult = {
  data: MyMissionEntry[] | null;
  chains: Record<string, MissionChainItem[]>;
  error: MyMissionsApiError | null;
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

function resolveRepsPerRound(entry: MyMissionEntry): number | null {
  if (entry.workout.length > 0) {
    try {
      return computeRepsPerRound(entry.workout);
    } catch {
      return null;
    }
  }
  return entry.repsPerRound;
}

export function computeMyMissionBaseScore(entry: MyMissionEntry): number {
  const repsPerRound = resolveRepsPerRound(entry);
  if (repsPerRound === null) {
    return entry.roundCount;
  }
  return computeBaseScore(entry.roundCount, entry.partialReps, repsPerRound);
}

export function isMyMissionScoreScorable(entry: MyMissionEntry): boolean {
  return resolveRepsPerRound(entry) !== null;
}

/** 0 for a workout that is not Phase-1 reps/sec scorable — a round-based mission. */
export function getMyMissionRepsPerRound(entry: MyMissionEntry): number {
  return resolveRepsPerRound(entry) ?? 0;
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
  return entry.role === 'host' && !entry.hasScoreBreakdown && entry.state !== 'finished';
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
  const hasScoreBreakdown = row.has_score_breakdown === true || scoreBreakdown !== null;
  const workout = readWorkout(row.workout);
  const repsPerRound =
    row.reps_per_round === null || row.reps_per_round === undefined
      ? null
      : readNumber(row.reps_per_round);
  const movementCount = readNumber(row.movement_count) ?? (workout.length > 0 ? workout.length : 0);

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
    workout,
    movementCount,
    repsPerRound,
    templateId: readString(row.template_id),
    intensityTier: typeof row.intensity_tier === 'number' ? row.intensity_tier : null,
    rallyPointId: readString(row.rally_point_id),
    modifiedMovements: readModifiedMovements(row.modified_movements),
    movementVariants: readMovementVariants(row.movement_variants),
    rpe: readRpe(row.rpe),
    sessionNotes: readSessionNotes(row.session_notes),
    checkIns: readCheckIns(row.check_ins),
    state,
    segmentIndex,
    roundCount,
    partialReps,
    finalScore,
    hasScoreBreakdown,
    scoreBreakdown,
    coachWorkoutName: readString(row.coach_workout_name),
  };
}

function parseEmbeddedChainItem(raw: Record<string, unknown>): MissionChainItem | null {
  const id = readString(raw.id);
  const position = typeof raw.position === 'number' ? raw.position : null;
  const durationMinutes = typeof raw.duration_minutes === 'number' ? raw.duration_minutes : null;
  if (!id || position === null || durationMinutes === null) {
    return null;
  }

  return {
    id,
    position,
    durationMinutes,
    workout: readWorkout(raw.workout),
    templateId: readString(raw.template_id),
    intensityTier: typeof raw.intensity_tier === 'number' ? raw.intensity_tier : null,
    startedMissionId: readString(raw.started_mission_id),
  };
}

function parseEmbeddedChains(raw: unknown): Record<string, MissionChainItem[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const next: Record<string, MissionChainItem[]> = {};
  for (const [rallyPointId, itemsRaw] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(itemsRaw)) {
      continue;
    }
    const items: MissionChainItem[] = [];
    for (const entry of itemsRaw) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }
      const parsed = parseEmbeddedChainItem(entry as Record<string, unknown>);
      if (parsed) {
        items.push(parsed);
      }
    }
    if (items.length >= 2) {
      next[rallyPointId] = items;
    }
  }
  return next;
}

export async function fetchMyMissions(): Promise<MyMissionsListResult> {
  const { data, error } = await callRpc('my_missions');

  if (error) {
    return { data: null, chains: {}, error: { message: error.message } };
  }

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

  if (raw.ok !== true) {
    return {
      data: null,
      chains: {},
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  const missions = Array.isArray(raw.missions) ? raw.missions : [];
  const entries = missions
    .map((mission) => parseMyMissionEntry(mission))
    .filter((entry): entry is MyMissionEntry => entry !== null);

  return { data: entries, chains: parseEmbeddedChains(raw.chains), error: null };
}

export type MyMissionDetail = {
  missionId: string;
  workout: WorkoutExercise[];
  /** Stored mission intensity; null when the original row had none. */
  intensityTier: number | null;
  scoreBreakdown: ScoreBreakdown | null;
};

export async function fetchMyMissionDetail(
  missionId: string
): Promise<{ data: MyMissionDetail | null; error: MyMissionsApiError | null }> {
  const { data, error } = await callRpc('my_mission_detail', {
    p_mission_id: missionId,
  });

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

  const parsedMissionId = readString(raw.mission_id);
  if (!parsedMissionId) {
    return {
      data: null,
      error: { message: 'Something went wrong. Please try again.' },
    };
  }

  const scoreBreakdown =
    raw.score_breakdown === null || raw.score_breakdown === undefined
      ? null
      : readScoreBreakdown(raw.score_breakdown);

  return {
    data: {
      missionId: parsedMissionId,
      workout: readWorkout(raw.workout),
      intensityTier: typeof raw.intensity_tier === 'number' ? raw.intensity_tier : null,
      scoreBreakdown,
    },
    error: null,
  };
}

export type UnlockedAmqapMission = {
  missionId: string;
  participantId: string;
  segmentIndex: number;
  templateId: string | null;
  state: string;
};

export async function fetchUnlockedAmqapMissions(): Promise<{
  data: UnlockedAmqapMission[] | null;
  error: MyMissionsApiError | null;
}> {
  const { data, error } = await callRpc('list_unlocked_amqap');

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
  const entries: UnlockedAmqapMission[] = [];
  for (const row of missions) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const r = row as Record<string, unknown>;
    const missionId = readString(r.mission_id);
    const participantId = readString(r.participant_id);
    const state = readString(r.state);
    if (!missionId || !participantId || !state) {
      continue;
    }
    entries.push({
      missionId,
      participantId,
      segmentIndex: readNumber(r.segment_index) ?? 0,
      templateId: readString(r.template_id),
      state,
    });
  }

  return { data: entries, error: null };
}

/** Merge detail fields into a list entry after hydrate. */
export function applyMyMissionDetail(
  entry: MyMissionEntry,
  detail: MyMissionDetail
): MyMissionEntry {
  return {
    ...entry,
    workout: detail.workout,
    movementCount: detail.workout.length > 0 ? detail.workout.length : entry.movementCount,
    intensityTier: detail.intensityTier,
    scoreBreakdown: detail.scoreBreakdown,
    hasScoreBreakdown: entry.hasScoreBreakdown || detail.scoreBreakdown !== null,
  };
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
