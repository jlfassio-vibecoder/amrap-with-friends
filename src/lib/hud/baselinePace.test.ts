import { describe, expect, it } from 'vitest';
import { BASELINE_PACE_BAND, evaluateBaselinePace } from '@/lib/hud/baselinePace';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const weekEndsAt = '2026-09-14T07:00:00.000Z';
const weekStartMs = Date.parse(weekEndsAt) - WEEK_MS;

describe('evaluateBaselinePace', () => {
  it('is null for a zero or invalid baseline', () => {
    expect(evaluateBaselinePace(40, 0, weekEndsAt, weekStartMs)).toBeNull();
    expect(evaluateBaselinePace(40, 150, 'not-a-date', weekStartMs)).toBeNull();
  });

  it('marks the baseline met once weekly minutes clear the quota', () => {
    const midWeek = weekStartMs + 3 * 24 * 60 * 60 * 1000;
    const pace = evaluateBaselinePace(150, 150, weekEndsAt, midWeek);
    expect(pace?.status).toBe('met');
    expect(pace?.label).toBe('Baseline met');
    expect(pace?.remainingMinutesToBaseline).toBe(0);
  });

  it('uses target met / short-of-target copy when targetNoun is target', () => {
    const midWeek = weekStartMs + WEEK_MS / 2;
    const met = evaluateBaselinePace(300, 300, weekEndsAt, midWeek, 'target');
    expect(met?.label).toBe('Target met');

    const behind = evaluateBaselinePace(40, 300, weekEndsAt, midWeek, 'target');
    expect(behind?.status).toBe('behind');
    expect(behind?.detail).toMatch(/Need .* min over/);
  });

  it('is on pace at the open of the week with no minutes yet', () => {
    const pace = evaluateBaselinePace(0, 150, weekEndsAt, weekStartMs);
    expect(pace?.status).toBe('on_pace');
    expect(pace?.expectedMinutes).toBe(0);
    expect(pace?.detail).toMatch(/Need 150 min over 7 days/);
  });

  it('is behind when volume lags the even-pace expectation', () => {
    // Halfway through the week, only 40 of 150 expected (~75).
    const midWeek = weekStartMs + WEEK_MS / 2;
    const pace = evaluateBaselinePace(40, 150, weekEndsAt, midWeek);
    expect(pace?.status).toBe('behind');
    expect(pace?.label).toBe('Behind pace');
    expect(pace?.expectedMinutes).toBe(75);
    expect(pace?.detail).toMatch(/Need 110 min over/);
  });

  it('is ahead when volume is well above the even-pace expectation', () => {
    const midWeek = weekStartMs + WEEK_MS / 2;
    const pace = evaluateBaselinePace(120, 150, weekEndsAt, midWeek);
    expect(pace?.status).toBe('ahead');
    expect(pace?.label).toBe('Ahead of pace');
    expect(pace?.detail).toMatch(/On track for ~/);
    expect(120 / 75).toBeGreaterThan(1 + BASELINE_PACE_BAND);
  });

  it('stays on pace inside the tolerance band', () => {
    const midWeek = weekStartMs + WEEK_MS / 2;
    // Expected 75; 70 is within 10%.
    const pace = evaluateBaselinePace(70, 150, weekEndsAt, midWeek);
    expect(pace?.status).toBe('on_pace');
    expect(pace?.label).toBe('On pace');
  });
});
