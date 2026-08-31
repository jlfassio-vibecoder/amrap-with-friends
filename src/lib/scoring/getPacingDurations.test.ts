import { describe, it, expect } from 'vitest';
import {
  computeAveragePaceSec,
  getPacingDurations,
  shouldExcludeBuyInRound,
} from './getPacingDurations';

describe('getPacingDurations', () => {
  it('excludes first round when excludeFirstRound is true', () => {
    expect(getPacingDurations([120, 60, 60], { excludeFirstRound: true })).toEqual([60, 60]);
  });

  it('keeps all rounds when excludeFirstRound is false', () => {
    expect(getPacingDurations([120, 60, 60], { excludeFirstRound: false })).toEqual([120, 60, 60]);
  });
});

describe('computeAveragePaceSec', () => {
  it('returns mean duration in seconds', () => {
    expect(computeAveragePaceSec([60, 80, 100])).toBe(80);
  });

  it('returns null for empty input', () => {
    expect(computeAveragePaceSec([])).toBeNull();
  });
});

describe('shouldExcludeBuyInRound', () => {
  it('returns true for 10+ minute missions', () => {
    expect(shouldExcludeBuyInRound(10)).toBe(true);
    expect(shouldExcludeBuyInRound(15)).toBe(true);
  });

  it('returns false for missions under 10 minutes', () => {
    expect(shouldExcludeBuyInRound(9)).toBe(false);
  });
});
