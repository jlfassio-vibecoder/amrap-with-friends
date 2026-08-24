import { describe, it, expect } from 'vitest';
import { computeFinalScore } from './computeFinalScore';

describe('computeFinalScore', () => {
  it('applies the master equation with a single round at the end', () => {
    expect(computeFinalScore(175, 1.15, 1.5)).toBe(302);
  });

  it('rounds to the nearest whole integer', () => {
    expect(computeFinalScore(40, 1.15, 1.5)).toBe(69);
    expect(computeFinalScore(40, 1.0, 1.5)).toBe(60);
  });

  it('returns base score when multipliers are 1.0', () => {
    expect(computeFinalScore(175, 1.0, 1.0)).toBe(175);
  });
});
