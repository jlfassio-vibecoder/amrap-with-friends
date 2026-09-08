import { describe, expect, it } from 'vitest';
import {
  isIntensityShiftWeek,
  niceCeiling,
  scoreTrendFromHistory,
  summarizeScoreTrend,
  type ScoreTrendWeek,
} from '@/lib/hud/scoreTrend';
import type { HudHistoryWeek } from '@/lib/hud/types';

function historyWeek(overrides: Partial<HudHistoryWeek> = {}): HudHistoryWeek {
  return {
    weekStart: new Date(2026, 8, 7).toISOString(),
    minutes: 0,
    compliant: false,
    missionCount: 0,
    score: 0,
    pviAverage: null,
    missions: [],
    ...overrides,
  };
}

describe('scoreTrendFromHistory', () => {
  it('carries the weeks through in order, without rebucketing them', () => {
    const weeks = scoreTrendFromHistory([
      historyWeek({ minutes: 20, score: 200, missionCount: 1 }),
      historyWeek({ minutes: 40, score: 500, missionCount: 2 }),
    ]);

    expect(weeks).toHaveLength(2);
    expect(weeks[0].totalScore).toBe(200);
    expect(weeks[0].totalMinutes).toBe(20);
    expect(weeks[1].totalScore).toBe(500);
    expect(weeks[1].missionCount).toBe(2);
  });

  it('derives score per minute to one decimal', () => {
    const [week] = scoreTrendFromHistory([historyWeek({ minutes: 60, score: 700 })]);
    expect(week.scorePerMinute).toBe(11.7);
  });

  it('leaves score per minute null for a week with no minutes', () => {
    const [week] = scoreTrendFromHistory([historyWeek()]);
    expect(week.scorePerMinute).toBeNull();
  });

  it('preserves weekStart untouched, since the server already anchored it', () => {
    const weekStart = new Date(2026, 7, 31).toISOString();
    const [week] = scoreTrendFromHistory([historyWeek({ weekStart })]);
    expect(week.weekStart).toBe(weekStart);
  });

  it('is empty when the server sent no weeks', () => {
    expect(scoreTrendFromHistory([])).toEqual([]);
  });
});

describe('summarizeScoreTrend', () => {
  const priorWeek: ScoreTrendWeek = {
    weekStart: '2026-09-07T00:00:00.000Z',
    totalScore: 200,
    totalMinutes: 20,
    missionCount: 1,
    scorePerMinute: 10,
  };
  const thisWeek: ScoreTrendWeek = {
    weekStart: '2026-09-14T00:00:00.000Z',
    totalScore: 260,
    totalMinutes: 20,
    missionCount: 1,
    scorePerMinute: 13,
  };

  it('is null with no weeks', () => {
    expect(summarizeScoreTrend([])).toBeNull();
  });

  it('has no previous week or change percent with only one bucket', () => {
    const summary = summarizeScoreTrend([thisWeek]);
    expect(summary?.previousWeek).toBeNull();
    expect(summary?.scoreChangePercent).toBeNull();
  });

  it('computes percent change against the previous week', () => {
    const summary = summarizeScoreTrend([priorWeek, thisWeek]);
    expect(summary?.currentWeek).toBe(thisWeek);
    expect(summary?.previousWeek).toBe(priorWeek);
    expect(summary?.scoreChangePercent).toBe(30); // 260 vs 200 = +30%
  });

  it('does not divide by a zero previous score', () => {
    const zeroPrior: ScoreTrendWeek = { ...priorWeek, totalScore: 0 };
    const summary = summarizeScoreTrend([zeroPrior, thisWeek]);
    expect(summary?.scoreChangePercent).toBeNull();
  });
});

describe('isIntensityShiftWeek', () => {
  const flatMinutes: ScoreTrendWeek = {
    weekStart: '2026-09-07T00:00:00.000Z',
    totalScore: 200,
    totalMinutes: 40,
    missionCount: 2,
    scorePerMinute: 5,
  };

  it('flags a week with ~same minutes but a meaningfully different score', () => {
    const improved: ScoreTrendWeek = { ...flatMinutes, totalScore: 260, totalMinutes: 41 };
    expect(isIntensityShiftWeek(improved, flatMinutes)).toBe(true);
  });

  it('does not flag when minutes also moved — not an apples-to-apples week', () => {
    const trainedMore: ScoreTrendWeek = { ...flatMinutes, totalScore: 260, totalMinutes: 60 };
    expect(isIntensityShiftWeek(trainedMore, flatMinutes)).toBe(false);
  });

  it('does not flag a trivial score change', () => {
    const barelyDifferent: ScoreTrendWeek = { ...flatMinutes, totalScore: 204, totalMinutes: 40 };
    expect(isIntensityShiftWeek(barelyDifferent, flatMinutes)).toBe(false);
  });

  it('does not flag with no previous week', () => {
    expect(isIntensityShiftWeek(flatMinutes, null)).toBe(false);
  });

  it('does not flag when either week logged zero minutes', () => {
    const zeroMinutes: ScoreTrendWeek = { ...flatMinutes, totalMinutes: 0, totalScore: 0 };
    expect(isIntensityShiftWeek(flatMinutes, zeroMinutes)).toBe(false);
    expect(isIntensityShiftWeek(zeroMinutes, flatMinutes)).toBe(false);
  });
});

describe('niceCeiling', () => {
  it('rounds up to a clean 1/2/5/10 step at the value’s own magnitude', () => {
    expect(niceCeiling(87)).toBe(100);
    expect(niceCeiling(140)).toBe(200);
    expect(niceCeiling(320)).toBe(500);
    expect(niceCeiling(760)).toBe(1000);
    expect(niceCeiling(1000)).toBe(1000);
  });

  it('never rounds down — the ceiling is always >= the value', () => {
    for (const value of [1, 42, 99, 100, 101, 999, 1001, 4999]) {
      expect(niceCeiling(value)).toBeGreaterThanOrEqual(value);
    }
  });

  it('gives a sane default for zero or negative input', () => {
    expect(niceCeiling(0)).toBe(100);
    expect(niceCeiling(-5)).toBe(100);
  });
});
