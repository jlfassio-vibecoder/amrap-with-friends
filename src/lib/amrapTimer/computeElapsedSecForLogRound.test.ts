import { describe, it, expect } from 'vitest';
import { computeElapsedSecForLogRound } from './computeElapsedSecForLogRound';

describe('computeElapsedSecForLogRound', () => {
  const base = {
    phase: 'work' as const,
    isPaused: false,
    workStartedAtMs: new Date('2020-01-01T00:00:00.000Z').getTime(),
    workDurationSec: 900,
    pausedAccumMs: 0,
  };

  it('uses tick-based elapsed when it matches wall time', () => {
    const nowMs = new Date('2020-01-01T00:01:00.000Z').getTime();
    const v = computeElapsedSecForLogRound({ ...base, timeLeftSec: 840, nowMs });
    expect(v).toBe(60);
  });

  it('raises elapsed when the local clock still shows full time but work has started', () => {
    const nowMs = new Date('2020-01-01T00:01:30.000Z').getTime();
    const v = computeElapsedSecForLogRound({ ...base, timeLeftSec: 900, nowMs });
    expect(v).toBe(90);
  });

  // The finding: the tick clock is up to a second stale, and every round after
  // the first used to bank that stale number.
  it('uses wall time after the first round, not the second-old tick value', () => {
    const nowMs = new Date('2020-01-01T00:05:00.900Z').getTime();
    const v = computeElapsedSecForLogRound({ ...base, timeLeftSec: 601, nowMs });
    expect(v).toBe(300);
  });

  it('discounts banked pause time from the wall clock', () => {
    const nowMs = new Date('2020-01-01T00:05:00.000Z').getTime();
    const v = computeElapsedSecForLogRound({
      ...base,
      timeLeftSec: 660,
      pausedAccumMs: 60_000,
      nowMs,
    });
    expect(v).toBe(240);
  });

  it('keeps the tick value when the caller has no pause ledger', () => {
    const nowMs = new Date('2020-01-01T00:05:00.000Z').getTime();
    const v = computeElapsedSecForLogRound({
      ...base,
      timeLeftSec: 660,
      pausedAccumMs: null,
      nowMs,
    });
    expect(v).toBe(240);
  });

  it('skips wall correction when paused', () => {
    const nowMs = new Date('2020-01-01T00:10:00.000Z').getTime();
    const v = computeElapsedSecForLogRound({
      ...base,
      timeLeftSec: 900,
      isPaused: true,
      nowMs,
    });
    expect(v).toBe(0);
  });
});
