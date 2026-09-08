import { describe, expect, it } from 'vitest';
import {
  buildScoreTrend,
  isIntensityShiftWeek,
  niceCeiling,
  summarizeScoreTrend,
  type ScoreTrendWeek,
} from '@/lib/hud/scoreTrend';
import type { MyMissionEntry } from '@/lib/api/myMissions';

// A Wednesday, so "this week" runs Monday 2026-09-07 through Sunday 2026-09-13
// — every fixture below is dated against that anchor.
const NOW = new Date('2026-09-09T12:00:00');

function entry(overrides: Partial<MyMissionEntry> = {}): MyMissionEntry {
  return {
    participantId: '11111111-1111-4111-8111-111111111111',
    nickname: 'Justin',
    joinedAt: '2026-09-01T12:00:00.000Z',
    role: 'host',
    missionId: '22222222-2222-4222-8222-222222222222',
    createdAt: '2026-09-09T12:00:00.000Z',
    scheduledAt: null,
    isFeatured: false,
    durationMinutes: 20,
    workout: [],
    templateId: null,
    rallyPointId: null,
    chainItemCount: 0,
    chainUnstartedCount: 0,
    state: 'finished',
    segmentIndex: 0,
    roundCount: 10,
    partialReps: 0,
    finalScore: 236,
    scoreBreakdown: null,
    modifiedMovements: [],
    movementVariants: {},
    rpe: null,
    sessionNotes: '',
    checkIns: {},
    coachWorkoutName: null,
    ...overrides,
  };
}

function weekAt(dateIso: string, overrides: Partial<MyMissionEntry> = {}) {
  return entry({ scheduledAt: dateIso, ...overrides });
}

describe('buildScoreTrend', () => {
  it('returns exactly weekCount buckets, oldest first, ending at the current week', () => {
    const weeks = buildScoreTrend([], 4, NOW);
    expect(weeks).toHaveLength(4);
    // Current week (containing NOW) is last; each earlier bucket is 7 days back.
    const starts = weeks.map((w) => new Date(w.weekStart).getTime());
    for (let i = 1; i < starts.length; i += 1) {
      expect(starts[i] - starts[i - 1]).toBe(7 * 24 * 60 * 60 * 1000);
    }
    // Read back in local time, not toISOString(): a UTC+ machine would see
    // local midnight Sept 7 serialize to a Sept 6 instant, failing a
    // same-machine-only assertion for a reason that has nothing to do with
    // the bucketing logic under test.
    const lastWeekStart = new Date(weeks[3].weekStart);
    expect([
      lastWeekStart.getFullYear(),
      lastWeekStart.getMonth(),
      lastWeekStart.getDate(),
    ]).toEqual([2026, 8, 7]);
  });

  it('sums score and minutes for missions that land in the same week', () => {
    const entries = [
      weekAt('2026-09-08T09:00:00', { finalScore: 200, durationMinutes: 15 }),
      weekAt('2026-09-10T09:00:00', { finalScore: 150, durationMinutes: 10 }),
    ];
    const weeks = buildScoreTrend(entries, 1, NOW);
    expect(weeks[0].totalScore).toBe(350);
    expect(weeks[0].totalMinutes).toBe(25);
    expect(weeks[0].missionCount).toBe(2);
    expect(weeks[0].scorePerMinute).toBe(14);
  });

  it('keeps a mission out of a week it does not belong to', () => {
    // The prior Sunday, one week back from the current Monday-start.
    const entries = [weekAt('2026-09-06T23:59:00', { finalScore: 999, durationMinutes: 20 })];
    const weeks = buildScoreTrend(entries, 2, NOW);
    expect(weeks[0].totalScore).toBe(999); // Prior week
    expect(weeks[1].totalScore).toBe(0); // Current week — untouched
  });

  it('excludes missions with no locked score', () => {
    const entries = [weekAt('2026-09-08T09:00:00', { finalScore: null })];
    const weeks = buildScoreTrend(entries, 1, NOW);
    expect(weeks[0].totalScore).toBe(0);
    expect(weeks[0].missionCount).toBe(0);
  });

  it('falls back to createdAt when scheduledAt is null', () => {
    const entries = [
      entry({ scheduledAt: null, createdAt: '2026-09-08T09:00:00', finalScore: 100 }),
    ];
    const weeks = buildScoreTrend(entries, 1, NOW);
    expect(weeks[0].totalScore).toBe(100);
  });

  it('leaves scorePerMinute null for a week with no logged minutes', () => {
    const weeks = buildScoreTrend([], 1, NOW);
    expect(weeks[0].scorePerMinute).toBeNull();
  });

  it('drops a mission with an unparseable date rather than throwing', () => {
    const entries = [weekAt('not-a-date', { finalScore: 100 })];
    expect(() => buildScoreTrend(entries, 1, NOW)).not.toThrow();
    expect(buildScoreTrend(entries, 1, NOW)[0].totalScore).toBe(0);
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
