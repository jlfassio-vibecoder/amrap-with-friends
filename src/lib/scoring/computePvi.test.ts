import { describe, it, expect } from 'vitest';
import { computePvi } from './computePvi';

describe('computePvi', () => {
  it('returns 0 for perfectly even pacing', () => {
    expect(computePvi([60, 60, 60], { excludeFirstRound: false })).toBe(0);
  });

  it('returns null for a single round', () => {
    expect(computePvi([45], { excludeFirstRound: false })).toBeNull();
  });

  it('returns null when excludeFirstRound leaves only one duration', () => {
    expect(computePvi([30, 45], { excludeFirstRound: true })).toBeNull();
  });

  it('returns null when average round time is zero', () => {
    expect(computePvi([0, 0], { excludeFirstRound: false })).toBeNull();
  });

  it('computes P.V.I. from fastest, slowest, and average', () => {
    expect(computePvi([60, 80], { excludeFirstRound: false })).toBe(28.6);
  });

  it('excludes round 1 when excludeFirstRound is true', () => {
    const withBuyIn = computePvi([120, 60, 60], { excludeFirstRound: true });
    const withoutBuyIn = computePvi([120, 60, 60], { excludeFirstRound: false });

    expect(withBuyIn).toBe(0);
    expect(withoutBuyIn).toBe(75);
  });

  it('rounds to one decimal place', () => {
    expect(computePvi([60, 70, 80], { excludeFirstRound: false })).toBe(28.6);
  });
});
