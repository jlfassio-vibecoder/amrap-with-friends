export class ScoringValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScoringValidationError';
  }
}

export interface BaseScoreInput {
  fullRounds: number;
  partialReps: number;
  repsPerRound: number;
}
