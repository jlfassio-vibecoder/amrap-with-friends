import { describe, it, expect } from 'vitest';
import { getDomainWeight } from './getDomainWeight';
import { allTimeCaps, MAX_TIME_CAP, MIN_TIME_CAP } from '@/lib/timeDomains';

describe('getDomainWeight', () => {
  it('is unchanged at the four canonical minutes', () => {
    // Every score already stored in `score_breakdown` was computed with these.
    expect(getDomainWeight(5)).toBe(1.0);
    expect(getDomainWeight(10)).toBe(1.2);
    expect(getDomainWeight(15)).toBe(1.5);
    expect(getDomainWeight(20)).toBe(1.8);
  });

  it('interpolates every legal cap', () => {
    expect(getDomainWeight(3)).toBe(0.92);
    expect(getDomainWeight(4)).toBe(0.96);
    expect(getDomainWeight(7)).toBe(1.08);
    expect(getDomainWeight(8)).toBe(1.12);
    expect(getDomainWeight(9)).toBe(1.16);
    expect(getDomainWeight(12)).toBe(1.32);
    expect(getDomainWeight(13)).toBe(1.38);
    expect(getDomainWeight(14)).toBe(1.44);
    expect(getDomainWeight(18)).toBe(1.68);
    expect(getDomainWeight(19)).toBe(1.74);
    expect(getDomainWeight(25)).toBe(2.1);
  });

  it('never returns the old silent 1.0 for a legal cap above 5', () => {
    for (const cap of allTimeCaps().filter((minutes) => minutes > 5)) {
      expect(getDomainWeight(cap)).toBeGreaterThan(1.0);
    }
  });

  it('rises strictly with the clock across every legal cap, with no boundary jump', () => {
    const caps = allTimeCaps();
    const weights = caps.map(getDomainWeight);

    for (let index = 1; index < caps.length; index += 1) {
      expect(weights[index]).toBeGreaterThan(weights[index - 1]);
    }

    // The point of interpolating: crossing a domain boundary must not be worth
    // more per minute than staying inside one.
    const perMinute = caps
      .slice(1)
      .map((cap, index) => (weights[index + 1] - weights[index]) / (cap - caps[index]));
    expect(Math.max(...perMinute) - Math.min(...perMinute)).toBeLessThanOrEqual(0.021);
  });

  it('holds at the ends rather than extrapolating past the legal range', () => {
    expect(getDomainWeight(2)).toBe(getDomainWeight(MIN_TIME_CAP));
    expect(getDomainWeight(1)).toBe(getDomainWeight(MIN_TIME_CAP));
    expect(getDomainWeight(30)).toBe(getDomainWeight(MAX_TIME_CAP));
    expect(getDomainWeight(60)).toBe(getDomainWeight(MAX_TIME_CAP));
  });

  it('returns two-decimal values, not float noise', () => {
    for (const cap of allTimeCaps()) {
      expect(getDomainWeight(cap)).toBe(Math.round(getDomainWeight(cap) * 100) / 100);
    }
  });
});
