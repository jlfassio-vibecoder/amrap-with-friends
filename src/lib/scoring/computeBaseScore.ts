import { ScoringValidationError } from '@/lib/scoring/types';

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new ScoringValidationError(`${label} must be a non-negative integer.`);
  }
}

export function computeBaseScore(
  fullRounds: number,
  partialReps: number,
  repsPerRound: number
): number {
  assertNonNegativeInteger(fullRounds, 'fullRounds');
  assertNonNegativeInteger(partialReps, 'partialReps');

  if (!Number.isInteger(repsPerRound) || repsPerRound <= 0) {
    throw new ScoringValidationError('repsPerRound must be a positive integer.');
  }

  if (partialReps >= repsPerRound) {
    throw new ScoringValidationError(
      'partialReps must be less than repsPerRound; log a full round instead.'
    );
  }

  return fullRounds * repsPerRound + partialReps;
}
