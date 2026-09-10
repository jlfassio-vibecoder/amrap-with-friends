import { describe, it, expect } from 'vitest';
import { formatBytes, percentile, projectReconcileCost, projectRoundFanOut } from './reconcileCost';
import { LIVE_RECONCILE_MS } from '@/lib/realtime/liveReconcile';

describe('projectReconcileCost', () => {
  it('counts one snapshot per client per interval', () => {
    const cost = projectReconcileCost({
      snapshotBytes: 1_000,
      participants: 10,
      missionMinutes: 5,
      reconcileMs: 30_000,
    });
    expect(cost.snapshotsPerClient).toBe(10);
    expect(cost.totalSnapshots).toBe(100);
    expect(cost.totalBytes).toBe(100_000);
  });

  // The point of measuring: both factors scale with the roster, so the bytes
  // go up with its square even though the interval never changes.
  it('quadruples the bytes when the roster doubles at a fixed per-head payload', () => {
    const small = projectReconcileCost({
      snapshotBytes: 50 * 200,
      participants: 50,
      missionMinutes: 20,
      reconcileMs: LIVE_RECONCILE_MS,
    });
    const large = projectReconcileCost({
      snapshotBytes: 100 * 200,
      participants: 100,
      missionMinutes: 20,
      reconcileMs: LIVE_RECONCILE_MS,
    });
    expect(large.totalBytes).toBe(small.totalBytes * 4);
  });

  it('still charges the finish pull for a mission shorter than one interval', () => {
    const cost = projectReconcileCost({
      snapshotBytes: 100,
      participants: 3,
      missionMinutes: 0.25,
      reconcileMs: 30_000,
    });
    expect(cost.snapshotsPerClient).toBe(1);
    expect(cost.totalSnapshots).toBe(3);
  });

  it('refuses a non-positive interval rather than dividing by zero', () => {
    expect(() =>
      projectReconcileCost({
        snapshotBytes: 1,
        participants: 1,
        missionMinutes: 1,
        reconcileMs: 0,
      })
    ).toThrow('reconcileMs must be positive');
  });
});

describe('projectRoundFanOut', () => {
  it('delivers every round to every subscriber', () => {
    expect(projectRoundFanOut(100, 10)).toBe(100_000);
  });

  it('is zero when nobody is watching', () => {
    expect(projectRoundFanOut(0, 10)).toBe(0);
  });
});

describe('percentile', () => {
  it('interpolates between samples', () => {
    expect(percentile([10, 20, 30, 40], 50)).toBe(25);
    expect(percentile([10, 20, 30, 40], 0)).toBe(10);
    expect(percentile([10, 20, 30, 40], 100)).toBe(40);
  });

  it('does not mutate the caller array', () => {
    const samples = [3, 1, 2];
    percentile(samples, 50);
    expect(samples).toEqual([3, 1, 2]);
  });

  it('returns zero for no samples and the value for one', () => {
    expect(percentile([], 95)).toBe(0);
    expect(percentile([7], 95)).toBe(7);
  });
});

describe('formatBytes', () => {
  it('scales through the units', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(900 * 1024 * 1024)).toBe('900 MB');
  });
});
