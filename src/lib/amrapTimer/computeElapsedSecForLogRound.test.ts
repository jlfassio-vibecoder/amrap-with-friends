import { describe, it, expect } from 'vitest';
import { computeElapsedSecForLogRound } from './computeElapsedSecForLogRound';

describe('computeElapsedSecForLogRound', () => {
  const base = {
    phase: 'work' as const,
    isPaused: false,
    workStartedAtMs: new Date('2020-01-01T00:00:00.000Z').getTime(),
    workDurationSec: 900,
  };

  it('uses tick-based elapsed when it matches wall time on first round', () => {
    const nowMs = new Date('2020-01-01T00:01:00.000Z').getTime();
    const v = computeElapsedSecForLogRound({
      ...base,
      timeLeftSec: 840,
      roundCountInWork: 0,
      nowMs,
    });
    expect(v).toBe(60);
  });

  it('on first round, raises elapsed when local clock still shows full time but work has started', () => {
    const nowMs = new Date('2020-01-01T00:01:30.000Z').getTime();
    const v = computeElapsedSecForLogRound({
      ...base,
      timeLeftSec: 900,
      roundCountInWork: 0,
      nowMs,
    });
    expect(v).toBe(90);
  });

  it('does not use wall time after the first round in segment', () => {
    const nowMs = new Date('2020-01-01T00:05:00.000Z').getTime();
    const v = computeElapsedSecForLogRound({
      ...base,
      timeLeftSec: 400,
      roundCountInWork: 1,
      nowMs,
    });
    expect(v).toBe(500);
  });

  it('skips wall correction when paused', () => {
    const nowMs = new Date('2020-01-01T00:10:00.000Z').getTime();
    const v = computeElapsedSecForLogRound({
      ...base,
      timeLeftSec: 900,
      isPaused: true,
      roundCountInWork: 0,
      nowMs,
    });
    expect(v).toBe(0);
  });
});
