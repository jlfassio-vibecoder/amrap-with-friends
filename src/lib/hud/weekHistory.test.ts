import { describe, expect, it } from 'vitest';
import {
  baselineFillPercent,
  currentWeekIndex,
  formatWeekRangeLabel,
  hasInspectableHistory,
  isCurrentWeek,
  stepWeekIndex,
  weekAt,
} from '@/lib/hud/weekHistory';
import type { HudHistoryWeek } from '@/lib/hud/types';

function week(overrides: Partial<HudHistoryWeek> = {}): HudHistoryWeek {
  return {
    weekStart: '2026-09-07T07:00:00.000Z',
    minutes: 0,
    compliant: false,
    missionCount: 0,
    score: 0,
    pviAverage: null,
    missions: [],
    ...overrides,
  };
}

const TWELVE = Array.from({ length: 12 }, () => week());

describe('currentWeekIndex / isCurrentWeek', () => {
  it('is the last bucket the RPC returns', () => {
    expect(currentWeekIndex(TWELVE)).toBe(11);
    expect(isCurrentWeek(TWELVE, 11)).toBe(true);
    expect(isCurrentWeek(TWELVE, 10)).toBe(false);
  });

  it('is null with no weeks at all', () => {
    expect(currentWeekIndex([])).toBeNull();
    expect(isCurrentWeek([], 0)).toBe(false);
  });
});

describe('stepWeekIndex', () => {
  it('moves by the delta inside the window', () => {
    expect(stepWeekIndex(TWELVE, 5, 1)).toBe(6);
    expect(stepWeekIndex(TWELVE, 5, -1)).toBe(4);
  });

  it('clamps at the oldest week rather than wrapping to the newest', () => {
    expect(stepWeekIndex(TWELVE, 0, -1)).toBe(0);
    expect(stepWeekIndex(TWELVE, 0, -5)).toBe(0);
  });

  it('clamps at the current week rather than running off the end', () => {
    expect(stepWeekIndex(TWELVE, 11, 1)).toBe(11);
    expect(stepWeekIndex(TWELVE, 11, 4)).toBe(11);
  });

  it('is a no-op with no weeks', () => {
    expect(stepWeekIndex([], 0, -1)).toBe(0);
  });
});

describe('weekAt', () => {
  it('returns the week at an in-range index', () => {
    const weeks = [week({ minutes: 10 }), week({ minutes: 20 })];
    expect(weekAt(weeks, 1)?.minutes).toBe(20);
  });

  it('is null for no selection and for out-of-range indexes', () => {
    const weeks = [week()];
    expect(weekAt(weeks, null)).toBeNull();
    expect(weekAt(weeks, -1)).toBeNull();
    expect(weekAt(weeks, 5)).toBeNull();
  });
});

describe('hasInspectableHistory', () => {
  it('is false until some week holds a locked mission', () => {
    expect(hasInspectableHistory(TWELVE)).toBe(false);
    expect(hasInspectableHistory([])).toBe(false);
  });

  it('is true as soon as one week has a mission', () => {
    expect(hasInspectableHistory([week(), week({ missionCount: 1 })])).toBe(true);
  });
});

describe('formatWeekRangeLabel', () => {
  it('spans Monday to the following Sunday', () => {
    // Built from a local-midnight instant so the label is timezone-stable
    // for the machine running it, the way the RPC sends weekStart.
    const monday = new Date(2026, 8, 7);
    expect(formatWeekRangeLabel(monday.toISOString())).toBe('Sep 7 – Sep 13');
  });

  it('degrades rather than throwing on an unparseable instant', () => {
    expect(formatWeekRangeLabel('not-a-date')).toBe('Unknown week');
  });
});

describe('baselineFillPercent', () => {
  it('is the share of the baseline the week covered', () => {
    expect(baselineFillPercent(75, 150)).toBe(50);
  });

  it('caps at 100 so an over-quota week cannot overflow the bar', () => {
    expect(baselineFillPercent(600, 150)).toBe(100);
  });

  it('never goes negative, and survives a zero baseline', () => {
    expect(baselineFillPercent(-5, 150)).toBe(0);
    expect(baselineFillPercent(50, 0)).toBe(0);
  });
});
