import { describe, it, expect } from 'vitest';
import { computePviScore } from './computePviScore';

describe('computePviScore', () => {
  it('returns blind pacing defaults during work', () => {
    expect(computePviScore([60, 80], 15, 'work', 175)).toEqual({
      pvi: null,
      multiplier: 1.0,
      classification: 'Standard',
      verdict: '',
      adjustedScore: 175,
    });
  });

  it('computes adjusted score at finished state', () => {
    expect(computePviScore([60, 60, 60], 15, 'finished', 175)).toEqual({
      pvi: 0,
      multiplier: 1.15,
      classification: 'Elite Pacing',
      verdict: 'Surgical precision. You controlled the panic.',
      adjustedScore: 201,
    });
  });

  it('excludes round 1 for 10+ minute sessions at finish', () => {
    expect(computePviScore([120, 60, 60], 10, 'finished', 120)).toEqual({
      pvi: 0,
      multiplier: 1.15,
      classification: 'Elite Pacing',
      verdict: 'Surgical precision. You controlled the panic.',
      adjustedScore: 138,
    });
  });
});
