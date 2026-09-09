import { describe, expect, it } from 'vitest';
import {
  ATHLETES_MAX,
  ATHLETES_MIN,
  CREATOR_TIERS,
  DEFAULT_ATHLETES,
  DEFAULT_FOLLOWERS,
  FOLLOWERS_MAX,
  FOLLOWERS_MIN,
  athletesFromFollowers,
  autoTierIndex,
  estimateRevenue,
  followersFromAthletes,
  formatCount,
  formatMoney,
} from './estimateRevenue';

describe('autoTierIndex', () => {
  it('floors founding hosts at Builder', () => {
    expect(autoTierIndex(0)).toBe(1);
    expect(autoTierIndex(24)).toBe(1);
  });

  it('promotes at Partner and Anchor thresholds', () => {
    expect(autoTierIndex(100)).toBe(2);
    expect(autoTierIndex(300)).toBe(3);
  });
});

describe('estimateRevenue', () => {
  it('matches the page defaults: 1 mission × 20 athletes', () => {
    const result = estimateRevenue({ missionsPerWeek: 1, athletesPerRoom: 20 });
    // 1 * 4.3 * 20 * 0.2 * 0.07 * 12 ≈ 14.4 → 14 paid year one
    expect(result.paidYear).toBe(14);
    expect(result.autoTierIndex).toBe(1);
    expect(result.yearEarnings).toBe(14 * 50 * CREATOR_TIERS[1]!.share);
  });

  it('scales with more rooms and larger rooms', () => {
    const small = estimateRevenue({ missionsPerWeek: 1, athletesPerRoom: 20 });
    const large = estimateRevenue({ missionsPerWeek: 3, athletesPerRoom: 50 });
    expect(large.paidYear).toBeGreaterThan(small.paidYear);
  });
});

describe('athletesFromFollowers / followersFromAthletes', () => {
  it('anchors the page default 8,000 ↔ 20', () => {
    expect(athletesFromFollowers(DEFAULT_FOLLOWERS)).toBe(DEFAULT_ATHLETES);
    expect(followersFromAthletes(DEFAULT_ATHLETES)).toBe(DEFAULT_FOLLOWERS);
  });

  it('stays inside the 15–30 band for 5k–20k followers', () => {
    const at5k = athletesFromFollowers(5_000);
    const at20k = athletesFromFollowers(20_000);
    expect(at5k).toBeGreaterThanOrEqual(15);
    expect(at5k).toBeLessThanOrEqual(20);
    expect(at20k).toBeGreaterThanOrEqual(30);
    expect(at20k).toBeLessThanOrEqual(35);
  });

  it('clamps at slider extremes', () => {
    expect(athletesFromFollowers(FOLLOWERS_MIN)).toBe(ATHLETES_MIN);
    expect(athletesFromFollowers(FOLLOWERS_MAX)).toBeLessThan(ATHLETES_MAX);
    expect(followersFromAthletes(ATHLETES_MIN)).toBe(FOLLOWERS_MIN);
    expect(followersFromAthletes(ATHLETES_MAX)).toBe(FOLLOWERS_MAX);
  });

  it('round-trips within one slider step', () => {
    for (const followers of [500, 5_000, 8_000, 20_000, 50_000, 100_000]) {
      const athletes = athletesFromFollowers(followers);
      const back = followersFromAthletes(athletes);
      // Inverse of a snapped √ is not exact — same room size when re-derived.
      expect(athletesFromFollowers(back)).toBe(athletes);
    }
    for (const athletes of [5, 15, 20, 30, 50, 70]) {
      const followers = followersFromAthletes(athletes);
      expect(athletesFromFollowers(followers)).toBe(athletes);
    }
  });
});

describe('formatters', () => {
  it('formats money and counts for the US locale', () => {
    expect(formatMoney(1234.6)).toBe('$1,235');
    expect(formatCount(8000)).toBe('8,000');
  });
});
