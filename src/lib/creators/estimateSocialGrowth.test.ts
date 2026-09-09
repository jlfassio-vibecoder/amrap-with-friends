import { describe, expect, it } from 'vitest';
import {
  CARD_FOLLOW_RATE,
  CARD_POST_RATE,
  LIVE_FOLLOW_RATE,
  LIVE_REACH_RATE,
  VIEWS_PER_CARD_POST,
  WEEKS_PER_YEAR,
  estimateSocialGrowth,
  formatFollows,
  formatPercent,
} from './estimateSocialGrowth';

describe('estimateSocialGrowth', () => {
  it('matches page defaults: 8k followers, 1 mission, 20 athletes', () => {
    const result = estimateSocialGrowth({
      followers: 8000,
      missionsPerWeek: 1,
      athletesPerRoom: 20,
    });

    // Live: 8000 * 0.02 = 160 viewers → 160 * 0.03 = 4.8 follows
    expect(result.liveViewersPerWeek).toBe(160);
    expect(result.followsFromLivePerWeek).toBeCloseTo(4.8);

    // Cards: 20 * 0.25 = 5 posts × 40 views = 200 → 200 * 0.01 = 2 follows
    expect(result.cardViewsPerWeek).toBe(200);
    expect(result.followsFromCardsPerWeek).toBeCloseTo(2);

    expect(result.followsPerWeek).toBeCloseTo(6.8);
    expect(result.followsPerYear).toBeCloseTo(6.8 * WEEKS_PER_YEAR);
    expect(result.yearLiftRate).toBeCloseTo((6.8 * WEEKS_PER_YEAR) / 8000);
  });

  it('scales with missions per week', () => {
    const once = estimateSocialGrowth({
      followers: 8000,
      missionsPerWeek: 1,
      athletesPerRoom: 20,
    });
    const thrice = estimateSocialGrowth({
      followers: 8000,
      missionsPerWeek: 3,
      athletesPerRoom: 20,
    });
    expect(thrice.followsPerWeek).toBeCloseTo(once.followsPerWeek * 3);
  });

  it('uses the documented conservative rate constants', () => {
    expect(LIVE_REACH_RATE).toBe(0.02);
    expect(LIVE_FOLLOW_RATE).toBe(0.03);
    expect(CARD_POST_RATE).toBe(0.25);
    expect(VIEWS_PER_CARD_POST).toBe(40);
    expect(CARD_FOLLOW_RATE).toBe(0.01);
  });
});

describe('formatters', () => {
  it('formats follows and percents for display', () => {
    expect(formatFollows(353.6)).toBe('354');
    expect(formatPercent(0.045)).toBe('4.5%');
  });
});
