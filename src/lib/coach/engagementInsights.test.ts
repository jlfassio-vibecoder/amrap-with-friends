import { describe, expect, it } from 'vitest';
import {
  dropoffHeadline,
  socialLift,
  socialLiftIsMeaningful,
  toRetentionGrid,
  weekOneReturnRate,
  type MissionDropoffRow,
  type RetentionCell,
  type SocialLiftRow,
} from '@/lib/coach/engagementInsights';

function dropoff(order: number, bucket: string, abandons: number): MissionDropoffRow {
  return {
    bucketOrder: order,
    elapsedBucket: bucket,
    abandons,
    pctOfAbandons: null,
    medianElapsedPct: null,
    medianRounds: null,
  };
}

function lift(cohort: string, overrides: Partial<SocialLiftRow> = {}): SocialLiftRow {
  return {
    cohort,
    participations: 100,
    athletes: 50,
    completed: 50,
    completionRatePct: 50,
    returnEligible: 80,
    returnedWithin14d: 40,
    returnRatePct: 50,
    avgGroupSize: 1,
    ...overrides,
  };
}

function cell(week: string, size: number, offset: number, retained: number): RetentionCell {
  return {
    cohortWeek: week,
    cohortSize: size,
    weekOffset: offset,
    retained,
    retainedPct: size === 0 ? null : Math.round((1000 * retained) / size) / 10,
  };
}

describe('dropoffHeadline', () => {
  it('names the worst bucket rather than averaging opposite problems', () => {
    expect(
      dropoffHeadline([
        dropoff(1, 'First fifth (0-20%)', 30),
        dropoff(3, 'Middle (40-60%)', 10),
        dropoff(5, 'Final fifth (80-100%)', 10),
      ])
    ).toBe('60% of abandonments happen in the first fifth (0-20%).');
  });

  it('says nothing when there is nothing to say', () => {
    expect(dropoffHeadline([])).toBeNull();
    expect(dropoffHeadline([dropoff(1, 'First fifth (0-20%)', 0)])).toBeNull();
  });
});

describe('socialLift', () => {
  it('reports the gap in percentage points', () => {
    const rows = [
      lift('solo', { completionRatePct: 41.2 }),
      lift('social', { completionRatePct: 63.7 }),
    ];
    expect(socialLift(rows, 'completionRatePct')).toEqual({
      solo: 41.2,
      social: 63.7,
      deltaPoints: 22.5,
    });
  });

  it('reports a negative lift honestly', () => {
    const rows = [lift('solo', { returnRatePct: 60 }), lift('social', { returnRatePct: 45 })];
    expect(socialLift(rows, 'returnRatePct').deltaPoints).toBe(-15);
  });

  it('returns null rather than inventing a delta when a cohort is missing', () => {
    expect(socialLift([lift('solo')], 'completionRatePct').deltaPoints).toBeNull();
  });
});

describe('socialLiftIsMeaningful', () => {
  it('refuses to back a claim built on a handful of missions', () => {
    expect(
      socialLiftIsMeaningful([
        lift('solo', { participations: 4 }),
        lift('social', { participations: 100 }),
      ])
    ).toBe(false);
  });

  it('accepts once both cohorts clear the floor', () => {
    expect(
      socialLiftIsMeaningful([
        lift('solo', { participations: 20 }),
        lift('social', { participations: 20 }),
      ])
    ).toBe(true);
  });

  it('is false when a cohort does not exist at all', () => {
    expect(socialLiftIsMeaningful([lift('social')])).toBe(false);
  });
});

describe('toRetentionGrid', () => {
  it('groups by cohort newest first with offsets ascending', () => {
    const grid = toRetentionGrid([
      cell('2026-08-31', 10, 1, 4),
      cell('2026-09-07', 8, 0, 8),
      cell('2026-08-31', 10, 0, 10),
      cell('2026-09-07', 8, 1, 2),
    ]);
    expect(grid.map((row) => row.cohortWeek)).toEqual(['2026-09-07', '2026-08-31']);
    expect(grid[0]?.cells.map((c) => c.weekOffset)).toEqual([0, 1]);
    expect(grid[1]?.cohortSize).toBe(10);
  });
});

describe('weekOneReturnRate', () => {
  it('weights cohorts by size instead of averaging their percentages', () => {
    // 90-person cohort at 10% and a 10-person cohort at 100% is 19%, not 55%.
    const rate = weekOneReturnRate([cell('2026-08-24', 90, 1, 9), cell('2026-08-31', 10, 1, 10)]);
    expect(rate).toBe(19);
  });

  it('ignores week 0, which is 100% by construction', () => {
    expect(weekOneReturnRate([cell('2026-08-31', 10, 0, 10)])).toBeNull();
  });
});
