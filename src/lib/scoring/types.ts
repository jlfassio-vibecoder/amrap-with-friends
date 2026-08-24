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

export interface PviMultiplierResult {
  multiplier: number;
  classification: string;
  verdict: string;
}

export interface ScoreBreakdown {
  baseScore: number;
  pvi: number | null;
  pviMultiplier: number;
  domainWeight: number;
  finalScore: number;
  roundCount?: number;
  roundSplits?: number[];
}
