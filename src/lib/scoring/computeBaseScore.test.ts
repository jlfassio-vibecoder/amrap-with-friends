import { describe, expect, it } from 'vitest';
import { computeBaseScore } from './computeBaseScore';
import { ScoringValidationError } from './types';

describe('computeBaseScore', () => {
  it('returns 0 for zero rounds and zero partial reps', () => {
    expect(computeBaseScore(0, 0, 40)).toBe(0);
  });

  it('computes score at exact round boundary with partial zero', () => {
    expect(computeBaseScore(4, 0, 40)).toBe(160);
  });

  it('computes high-volume partial reps', () => {
    expect(computeBaseScore(4, 15, 40)).toBe(175);
  });

  it('rejects partial reps equal to reps per round', () => {
    expect(() => computeBaseScore(4, 40, 40)).toThrow(ScoringValidationError);
  });

  it('rejects partial reps greater than reps per round', () => {
    expect(() => computeBaseScore(4, 41, 40)).toThrow(ScoringValidationError);
  });

  it('rejects negative full rounds', () => {
    expect(() => computeBaseScore(-1, 0, 40)).toThrow(ScoringValidationError);
  });

  it('rejects non-positive reps per round', () => {
    expect(() => computeBaseScore(1, 0, 0)).toThrow(ScoringValidationError);
  });
});
