import type { WorkoutExercise } from '@/lib/api/sessionTypes';

export type LiveSessionPhase = 'waiting' | 'setup' | 'work' | 'finished';

export interface SessionRow {
  id: string;
  duration_minutes: number;
  workout: WorkoutExercise[];
  state: LiveSessionPhase;
  time_left_sec: number;
  is_paused: boolean;
  started_at: string | null;
  segment_index: number;
  created_at: string;
}

export interface ParticipantRow {
  id: string;
  session_id: string;
  nickname: string;
  role: 'host' | 'joiner';
  joined_at: string;
}

export interface RoundRow {
  id: string;
  session_id: string;
  participant_id: string;
  round_index: number;
  elapsed_sec_at_round: number;
  segment_index: number;
  created_at: string;
}

export interface MessageRow {
  id: string;
  session_id: string;
  participant_id: string;
  nickname: string;
  body: string;
  segment_index: number;
  created_at: string;
}

export interface UpdateSessionStateInput {
  sessionId: string;
  hostToken: string;
  state: LiveSessionPhase;
  timeLeftSec: number;
  isPaused: boolean;
  startedAt?: string | null;
}

export interface UpdateSessionStateSuccess {
  ok: true;
  sessionId: string;
  state: LiveSessionPhase;
  timeLeftSec: number;
  isPaused: boolean;
  startedAt: string | null;
  segmentIndex: number;
}

export interface UpdateSessionStateFailure {
  ok: false;
  reason: string;
}

export type UpdateSessionStateResult =
  | UpdateSessionStateSuccess
  | UpdateSessionStateFailure;

export interface LogRoundInput {
  sessionId: string;
  participantId: string;
  claimToken: string;
  roundIndex: number;
  elapsedSecAtRound: number;
  segmentIndex: number;
}

export interface LogRoundSuccess {
  ok: true;
  roundId: string;
  roundIndex: number;
  elapsedSecAtRound: number;
  segmentIndex: number;
}

export interface LogRoundFailure {
  ok: false;
  reason: string;
}

export type LogRoundResult = LogRoundSuccess | LogRoundFailure;

export interface ParticipantSegmentResultRow {
  participant_id: string;
  segment_index: number;
  partial_reps: number;
  updated_at: string;
}

export interface SubmitParticipantResultInput {
  sessionId: string;
  participantId: string;
  claimToken: string;
  partialReps: number;
  segmentIndex: number;
}

export interface SubmitParticipantResultSuccess {
  ok: true;
  participantId: string;
  segmentIndex: number;
  partialReps: number;
  repsPerRound: number;
}

export interface SubmitParticipantResultFailure {
  ok: false;
  reason: string;
}

export type SubmitParticipantResultResult =
  | SubmitParticipantResultSuccess
  | SubmitParticipantResultFailure;

export interface SessionPresenceEntry {
  participantId: string;
  nickname: string;
  isOnline: boolean;
}

export interface LeaderboardRoundEntry {
  roundNumber: number;
  durationSec: number;
}

export interface LeaderboardEntry {
  participantId: string;
  nickname: string;
  roundCount: number;
  partialReps: number;
  repsPerRound: number;
  baseScore: number;
  pvi: number | null;
  pviMultiplier: number;
  pviClassification: string;
  pviVerdict: string;
  adjustedScore: number;
  rounds: LeaderboardRoundEntry[];
  isSelf: boolean;
}
