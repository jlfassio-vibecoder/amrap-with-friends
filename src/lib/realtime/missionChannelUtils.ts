import type {
  ParticipantRow,
  ParticipantSegmentResultRow,
  RoundRow,
  MissionRow,
  MessageRow,
  LeaderboardEntry,
  LiveMissionPhase,
} from '@/lib/missionSync/types';
import type { WorkoutExercise } from '@/lib/api/missionTypes';
import type { ScoreBreakdown } from '@/lib/scoring/types';
import { parseScoreBreakdownJson } from '@/lib/scoring/parseScoreBreakdownJson';
import { computeBaseScore } from '@/lib/scoring/computeBaseScore';
import { computeRepsPerRound } from '@/lib/scoring/computeRepsPerRound';
import { computeScoreBreakdown } from '@/lib/scoring/computeScoreBreakdown';
import { getPviMultiplier } from '@/lib/scoring/getPviMultiplier';

export interface PresenceTrackPayload {
  participant_id: string;
  nickname: string;
}

export interface PresenceByParticipantId {
  [participantId: string]: { nickname: string };
}

export function parseMissionRow(record: Record<string, unknown>): MissionRow | null {
  const id = typeof record.id === 'string' ? record.id : null;
  const durationMinutes =
    typeof record.duration_minutes === 'number' ? record.duration_minutes : null;
  const state = typeof record.state === 'string' ? record.state : null;
  const timeLeftSec = typeof record.time_left_sec === 'number' ? record.time_left_sec : null;
  const isPaused = typeof record.is_paused === 'boolean' ? record.is_paused : null;
  const segmentIndex = typeof record.segment_index === 'number' ? record.segment_index : null;
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

  if (state !== 'waiting' && state !== 'setup' && state !== 'work' && state !== 'finished') {
    return null;
  }

  const startedAt =
    record.started_at === null || record.started_at === undefined
      ? null
      : String(record.started_at);

  const scheduledAt =
    record.scheduled_at === null || record.scheduled_at === undefined
      ? null
      : String(record.scheduled_at);

  const rallyPointCountdownEndsAt =
    record.rally_point_countdown_ends_at === null ||
    record.rally_point_countdown_ends_at === undefined
      ? null
      : String(record.rally_point_countdown_ends_at);

  const templateIdRaw = record.template_id;
  const templateId =
    templateIdRaw === null || templateIdRaw === undefined
      ? null
      : typeof templateIdRaw === 'string' && templateIdRaw.trim().length > 0
        ? templateIdRaw.trim()
        : null;

  const rallyPointIdRaw = record.rally_point_id;
  const rallyPointId =
    rallyPointIdRaw === null || rallyPointIdRaw === undefined
      ? null
      : typeof rallyPointIdRaw === 'string' && rallyPointIdRaw.trim().length > 0
        ? rallyPointIdRaw.trim()
        : null;

  return {
    id,
    duration_minutes: durationMinutes,
    workout: workout as MissionRow['workout'],
    template_id: templateId,
    state,
    time_left_sec: timeLeftSec,
    is_paused: isPaused,
    started_at: startedAt,
    scheduled_at: scheduledAt,
    rally_point_countdown_ends_at: rallyPointCountdownEndsAt,
    segment_index: segmentIndex,
    created_at: createdAt,
    is_featured: record.is_featured === true,
    rally_point_id: rallyPointId,
  };
}

export function parseParticipantRow(record: Record<string, unknown>): ParticipantRow | null {
  const id = typeof record.id === 'string' ? record.id : null;
  const missionId = typeof record.mission_id === 'string' ? record.mission_id : null;
  const nickname = typeof record.nickname === 'string' ? record.nickname : null;
  const role = typeof record.role === 'string' ? record.role : null;
  const joinedAt = typeof record.joined_at === 'string' ? record.joined_at : null;

  if (!id || !missionId || !nickname || !joinedAt) {
    return null;
  }

  if (role !== 'host' && role !== 'joiner') {
    return null;
  }

  return {
    id,
    mission_id: missionId,
    nickname,
    role,
    joined_at: joinedAt,
  };
}

export function parseRoundRow(record: Record<string, unknown>): RoundRow | null {
  const id = typeof record.id === 'string' ? record.id : null;
  const missionId = typeof record.mission_id === 'string' ? record.mission_id : null;
  const participantId = typeof record.participant_id === 'string' ? record.participant_id : null;
  const roundIndex = typeof record.round_index === 'number' ? record.round_index : null;
  const elapsedSecAtRound =
    typeof record.elapsed_sec_at_round === 'number' ? record.elapsed_sec_at_round : null;
  const segmentIndex = typeof record.segment_index === 'number' ? record.segment_index : null;
  // Absent on rows written before the column existed, and absent from a
  // Realtime payload that filtered it out; both mean "logged live".
  const missedLogReps = typeof record.missed_log_reps === 'number' ? record.missed_log_reps : null;
  const createdAt = typeof record.created_at === 'string' ? record.created_at : null;

  if (
    !id ||
    !missionId ||
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
    mission_id: missionId,
    participant_id: participantId,
    round_index: roundIndex,
    elapsed_sec_at_round: elapsedSecAtRound,
    segment_index: segmentIndex,
    missed_log_reps: missedLogReps,
    created_at: createdAt,
  };
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseScoreBreakdown(value: unknown): ScoreBreakdown | null {
  return parseScoreBreakdownJson(value);
}

export function parseSegmentResultRow(
  record: Record<string, unknown>
): ParticipantSegmentResultRow | null {
  const participantId = typeof record.participant_id === 'string' ? record.participant_id : null;
  const segmentIndex = typeof record.segment_index === 'number' ? record.segment_index : null;
  const partialReps = typeof record.partial_reps === 'number' ? record.partial_reps : null;
  const finalScore =
    record.final_score === null || record.final_score === undefined
      ? null
      : readNumber(record.final_score);
  const scoreBreakdown =
    record.score_breakdown === null || record.score_breakdown === undefined
      ? null
      : parseScoreBreakdown(record.score_breakdown);
  const updatedAt = typeof record.updated_at === 'string' ? record.updated_at : null;

  if (!participantId || segmentIndex === null || partialReps === null || !updatedAt) {
    return null;
  }

  if (record.final_score !== null && record.final_score !== undefined && finalScore === null) {
    return null;
  }

  if (
    record.score_breakdown !== null &&
    record.score_breakdown !== undefined &&
    scoreBreakdown === null
  ) {
    return null;
  }

  return {
    participant_id: participantId,
    segment_index: segmentIndex,
    partial_reps: partialReps,
    final_score: finalScore,
    score_breakdown: scoreBreakdown,
    updated_at: updatedAt,
  };
}

export function parseMessageRow(record: Record<string, unknown>): MessageRow | null {
  const id = typeof record.id === 'string' ? record.id : null;
  const missionId = typeof record.mission_id === 'string' ? record.mission_id : null;
  const participantId = typeof record.participant_id === 'string' ? record.participant_id : null;
  const nickname = typeof record.nickname === 'string' ? record.nickname : null;
  const body = typeof record.body === 'string' ? record.body : null;
  const segmentIndex = typeof record.segment_index === 'number' ? record.segment_index : null;
  const createdAt = typeof record.created_at === 'string' ? record.created_at : null;

  if (
    !id ||
    !missionId ||
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
    mission_id: missionId,
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

export function upsertSegmentResult(
  results: ParticipantSegmentResultRow[],
  row: ParticipantSegmentResultRow
): ParticipantSegmentResultRow[] {
  const existingIndex = results.findIndex(
    (result) =>
      result.participant_id === row.participant_id && result.segment_index === row.segment_index
  );

  if (existingIndex >= 0) {
    return results.map((result, index) => (index === existingIndex ? row : result));
  }

  return [...results, row];
}

export function removeSegmentResult(
  results: ParticipantSegmentResultRow[],
  participantId: string,
  segmentIndex: number
): ParticipantSegmentResultRow[] {
  return results.filter(
    (result) => !(result.participant_id === participantId && result.segment_index === segmentIndex)
  );
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

export function buildParticipantRoundSummaries(
  rounds: RoundRow[],
  participantId: string,
  segmentIndex: number
): Array<{ roundNumber: number; durationSec: number }> {
  const participantRounds = rounds
    .filter(
      (round) => round.participant_id === participantId && round.segment_index === segmentIndex
    )
    .sort((a, b) => a.round_index - b.round_index);

  return summarizeSortedParticipantRounds(participantRounds);
}

function summarizeSortedParticipantRounds(
  participantRounds: RoundRow[]
): Array<{ roundNumber: number; durationSec: number }> {
  return participantRounds.map((round, index) => {
    const previousElapsed = index > 0 ? participantRounds[index - 1].elapsed_sec_at_round : 0;

    return {
      roundNumber: round.round_index + 1,
      durationSec: Math.max(0, round.elapsed_sec_at_round - previousElapsed),
    };
  });
}

export function buildLeaderboard(
  participants: ParticipantRow[],
  rounds: RoundRow[],
  segmentResults: ParticipantSegmentResultRow[],
  segmentIndex: number,
  selfParticipantId: string,
  workout: WorkoutExercise[],
  durationMinutes: number,
  missionPhase: LiveMissionPhase
): LeaderboardEntry[] {
  let repsPerRound = 0;
  try {
    repsPerRound = computeRepsPerRound(workout);
  } catch {
    repsPerRound = 0;
  }

  const partialByParticipant = new Map<string, number>();
  const lockedByParticipant = new Map<string, { finalScore: number; breakdown: ScoreBreakdown }>();

  for (const result of segmentResults) {
    if (result.segment_index !== segmentIndex) {
      continue;
    }

    partialByParticipant.set(result.participant_id, result.partial_reps);

    if (result.final_score !== null && result.score_breakdown !== null) {
      lockedByParticipant.set(result.participant_id, {
        finalScore: result.final_score,
        breakdown: result.score_breakdown,
      });
    }
  }

  const counts = new Map<string, number>();
  const roundsByParticipant = new Map<string, RoundRow[]>();

  for (const round of rounds) {
    if (round.segment_index !== segmentIndex) {
      continue;
    }

    counts.set(round.participant_id, (counts.get(round.participant_id) ?? 0) + 1);

    const participantRounds = roundsByParticipant.get(round.participant_id) ?? [];
    participantRounds.push(round);
    roundsByParticipant.set(round.participant_id, participantRounds);
  }

  for (const participantRounds of roundsByParticipant.values()) {
    participantRounds.sort((a, b) => a.round_index - b.round_index);
  }

  return participants
    .map((participant) => {
      const participantRounds = roundsByParticipant.get(participant.id) ?? [];
      const liveRoundCount = counts.get(participant.id) ?? 0;
      const partialReps = partialByParticipant.get(participant.id) ?? 0;
      // Copilot suggestion ignored: round-count fallback is intentional for unsupported workouts; UI labels rounds vs reps via repsPerRound.
      const baseScore =
        repsPerRound > 0
          ? computeBaseScore(liveRoundCount, partialReps, repsPerRound)
          : liveRoundCount;
      const locked = lockedByParticipant.get(participant.id);
      const roundSummaries =
        locked?.breakdown.roundSplits && locked.breakdown.roundSplits.length > 0
          ? locked.breakdown.roundSplits.map((durationSec, index) => ({
              roundNumber: index + 1,
              durationSec,
            }))
          : summarizeSortedParticipantRounds(participantRounds);
      const roundCount =
        locked?.breakdown.roundSplits && locked.breakdown.roundSplits.length > 0
          ? (locked.breakdown.roundCount ?? locked.breakdown.roundSplits.length)
          : liveRoundCount;
      const roundDurationsSec = roundSummaries.map((round) => round.durationSec);
      const breakdown = locked
        ? locked.breakdown
        : computeScoreBreakdown(roundDurationsSec, durationMinutes, missionPhase, baseScore);
      const finalScore = locked ? locked.finalScore : breakdown.finalScore;
      const pviTier = getPviMultiplier(breakdown.pvi);

      return {
        participantId: participant.id,
        nickname: participant.nickname,
        roundCount,
        partialReps,
        repsPerRound,
        baseScore: breakdown.baseScore,
        pvi: breakdown.pvi,
        pviMultiplier: breakdown.pviMultiplier,
        pviClassification: missionPhase === 'finished' ? pviTier.classification : 'Standard',
        pviVerdict: missionPhase === 'finished' ? pviTier.verdict : '',
        domainWeight: breakdown.domainWeight,
        finalScore,
        rounds: roundSummaries,
        isSelf: participant.id === selfParticipantId,
      };
    })
    .sort((a, b) => {
      const scoreA = missionPhase === 'finished' ? a.finalScore : a.baseScore;
      const scoreB = missionPhase === 'finished' ? b.finalScore : b.baseScore;

      if (scoreB !== scoreA) {
        return scoreB - scoreA;
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
