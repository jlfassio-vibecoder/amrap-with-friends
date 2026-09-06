import { describe, it, expect } from 'vitest';
import {
  computeAveragePaceSec,
  getPacingDurations,
  shouldExcludeBuyInRound,
} from './getPacingDurations';
import { capsForDomain } from '@/lib/timeDomains';

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
  it('excludes the buy-in on every cap outside Ultra-Short', () => {
    for (const domain of [10, 15, 20] as const) {
      for (const cap of capsForDomain(domain)) {
        expect(shouldExcludeBuyInRound(cap)).toBe(true);
      }
    }
  });

  it('counts every round on an Ultra-Short mission', () => {
    for (const cap of capsForDomain(5)) {
      expect(shouldExcludeBuyInRound(cap)).toBe(false);
    }
  });

  it('is consistent inside the Short domain, which the old >= 10 rule was not', () => {
    expect(shouldExcludeBuyInRound(7)).toBe(shouldExcludeBuyInRound(10));
  });

  it('stays continuous across the gaps for non-domain coach WODs', () => {
    expect(shouldExcludeBuyInRound(6)).toBe(false);
    expect(shouldExcludeBuyInRound(30)).toBe(true);
  });
});
