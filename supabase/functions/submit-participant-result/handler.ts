import { computeBaseScore } from '@/lib/scoring/computeBaseScore';
import { computeRepsPerRound } from '@/lib/scoring/computeRepsPerRound';
import { computeScoreBreakdown } from '@/lib/scoring/computeScoreBreakdown';
import type { ScoreBreakdown } from '@/lib/scoring/types';
import type { WorkoutExercise } from '@/lib/api/sessionTypes';

export interface SubmitParticipantResultRequest {
  sessionId: string;
  participantId: string;
  claimToken: string;
  partialReps: number;
  segmentIndex: number;
}

export interface SubmitParticipantResultResponse {
  ok: boolean;
  reason?: string;
  participantId?: string;
  segmentIndex?: number;
  partialReps?: number;
  repsPerRound?: number;
  finalScore?: number;
  scoreBreakdown?: ScoreBreakdown;
}

export interface RoundRow {
  round_index: number;
  elapsed_sec_at_round: number;
}

export interface ParticipantRecord {
  claim_token_hash: string | null;
  session_id: string;
  user_id: string | null;
}

export interface SessionRecord {
  state: string;
  segment_index: number;
  workout: WorkoutExercise[];
  duration_minutes: number;
}

export interface ExistingSegmentResult {
  score_breakdown: ScoreBreakdown | null;
}

export function deriveRoundDurationsSec(rounds: RoundRow[]): number[] {
  const sorted = [...rounds].sort((a, b) => a.round_index - b.round_index);

  return sorted.map((round, index) => {
    const previousElapsed =
      index > 0 ? sorted[index - 1].elapsed_sec_at_round : 0;

    return Math.max(0, round.elapsed_sec_at_round - previousElapsed);
  });
}

export async function hashClaimToken(claimToken: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(claimToken)
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function isAuthorizedParticipant(
  participant: ParticipantRecord,
  sessionId: string,
  claimTokenHash: string | null,
  authUserId: string | null
): boolean {
  if (participant.session_id !== sessionId) {
    return false;
  }

  if (
    participant.claim_token_hash !== null &&
    claimTokenHash !== null &&
    participant.claim_token_hash === claimTokenHash
  ) {
    return true;
  }

  return (
    authUserId !== null &&
    participant.user_id !== null &&
    participant.user_id === authUserId
  );
}

export function validateSubmitRequest(
  body: SubmitParticipantResultRequest
): SubmitParticipantResultResponse | null {
  if (!body.sessionId || !body.participantId) {
    return { ok: false, reason: 'participant_not_found' };
  }

  if (
    typeof body.partialReps !== 'number' ||
    !Number.isInteger(body.partialReps) ||
    body.partialReps < 0
  ) {
    return { ok: false, reason: 'invalid_partial_reps' };
  }

  if (
    typeof body.segmentIndex !== 'number' ||
    !Number.isInteger(body.segmentIndex) ||
    body.segmentIndex < 0
  ) {
    return { ok: false, reason: 'invalid_segment_index' };
  }

  if (typeof body.claimToken !== 'string') {
    return { ok: false, reason: 'invalid_claim_token' };
  }

  return null;
}

export function computeLockedScore(
  rounds: RoundRow[],
  workout: WorkoutExercise[],
  durationMinutes: number,
  partialReps: number
): { repsPerRound: number; breakdown: ScoreBreakdown } | SubmitParticipantResultResponse {
  let repsPerRound: number;

  try {
    repsPerRound = computeRepsPerRound(workout);
  } catch {
    return { ok: false, reason: 'invalid_workout' };
  }

  if (partialReps >= repsPerRound) {
    return { ok: false, reason: 'partial_reps_too_high' };
  }

  const roundCount = rounds.length;
  const baseScore = computeBaseScore(roundCount, partialReps, repsPerRound);
  const roundDurationsSec = deriveRoundDurationsSec(rounds);
  const breakdown = computeScoreBreakdown(
    roundDurationsSec,
    durationMinutes,
    'finished',
    baseScore
  );

  return { repsPerRound, breakdown };
}

export async function handleSubmitParticipantResult(
  body: SubmitParticipantResultRequest,
  deps: {
    authUserId: string | null;
    fetchParticipant: (
      participantId: string
    ) => Promise<ParticipantRecord | null>;
    fetchSession: (sessionId: string) => Promise<SessionRecord | null>;
    fetchExistingResult: (
      participantId: string,
      segmentIndex: number
    ) => Promise<ExistingSegmentResult | null>;
    fetchRounds: (
      participantId: string,
      segmentIndex: number
    ) => Promise<RoundRow[]>;
    persistResult: (input: {
      participantId: string;
      segmentIndex: number;
      partialReps: number;
      finalScore: number;
      scoreBreakdown: ScoreBreakdown;
    }) => Promise<{ ok: true } | { ok: false; reason: string }>;
  }
): Promise<SubmitParticipantResultResponse> {
  const validationError = validateSubmitRequest(body);
  if (validationError) {
    return validationError;
  }

  const claimTokenHash =
    body.claimToken.length > 0 ? await hashClaimToken(body.claimToken) : null;

  const participant = await deps.fetchParticipant(body.participantId);
  if (
    !participant ||
    !isAuthorizedParticipant(
      participant,
      body.sessionId,
      claimTokenHash,
      deps.authUserId
    )
  ) {
    return { ok: false, reason: 'invalid_claim_token' };
  }

  const session = await deps.fetchSession(body.sessionId);
  if (!session) {
    return { ok: false, reason: 'session_not_found' };
  }

  if (session.state !== 'finished') {
    return { ok: false, reason: 'session_not_submittable' };
  }

  if (body.segmentIndex !== session.segment_index) {
    return { ok: false, reason: 'stale_segment_index' };
  }

  const existing = await deps.fetchExistingResult(
    body.participantId,
    body.segmentIndex
  );

  if (existing?.score_breakdown !== null && existing?.score_breakdown !== undefined) {
    return { ok: false, reason: 'score_already_locked' };
  }

  const rounds = await deps.fetchRounds(body.participantId, body.segmentIndex);
  const computed = computeLockedScore(
    rounds,
    session.workout,
    session.duration_minutes,
    body.partialReps
  );

  if ('ok' in computed && computed.ok === false) {
    return computed;
  }

  const { repsPerRound, breakdown } = computed as {
    repsPerRound: number;
    breakdown: ScoreBreakdown;
  };

  const persisted = await deps.persistResult({
    participantId: body.participantId,
    segmentIndex: body.segmentIndex,
    partialReps: body.partialReps,
    finalScore: breakdown.finalScore,
    scoreBreakdown: breakdown,
  });

  if (!persisted.ok) {
    return persisted;
  }

  return {
    ok: true,
    participantId: body.participantId,
    segmentIndex: body.segmentIndex,
    partialReps: body.partialReps,
    repsPerRound,
    finalScore: breakdown.finalScore,
    scoreBreakdown: breakdown,
  };
}
