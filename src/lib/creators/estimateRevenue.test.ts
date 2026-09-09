import { describe, expect, it } from 'vitest';
import {
  CREATOR_TIERS,
  autoTierIndex,
  estimateRevenue,
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

describe('formatters', () => {
  it('formats money and counts for the US locale', () => {
    expect(formatMoney(1234.6)).toBe('$1,235');
    expect(formatCount(8000)).toBe('8,000');
  });
});
