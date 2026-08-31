import { describe, it, expect } from 'vitest';
import { computeScoreBreakdown } from './computeScoreBreakdown';

describe('computeScoreBreakdown', () => {
  it('returns blind pacing defaults during work', () => {
    expect(computeScoreBreakdown([60, 80], 15, 'work', 175)).toEqual({
      baseScore: 175,
      pvi: null,
      pviMultiplier: 1.0,
      domainWeight: 1.0,
      finalScore: 175,
    });
  });

  it('computes full breakdown at finished state', () => {
    expect(computeScoreBreakdown([60, 60, 60], 15, 'finished', 175)).toEqual({
      baseScore: 175,
      pvi: 0,
      pviMultiplier: 1.15,
      domainWeight: 1.5,
      finalScore: 302,
    });
  });

  it('excludes round 1 for 10+ minute missions at finish', () => {
    expect(computeScoreBreakdown([120, 60, 60], 10, 'finished', 120)).toEqual({
      baseScore: 120,
      pvi: 0,
      pviMultiplier: 1.15,
      domainWeight: 1.2,
      finalScore: 166,
    });
  });
});
