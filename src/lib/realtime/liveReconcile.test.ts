import { describe, it, expect } from 'vitest';
import { LIVE_RECONCILE_MS, shouldReconcileLiveState } from './liveReconcile';

describe('shouldReconcileLiveState', () => {
  it('reconciles while the clock can still produce rounds', () => {
    expect(shouldReconcileLiveState('setup')).toBe(true);
    expect(shouldReconcileLiveState('work')).toBe(true);
  });

  it('stops once nothing more can land', () => {
    expect(shouldReconcileLiveState('waiting')).toBe(false);
    expect(shouldReconcileLiveState('finished')).toBe(false);
    expect(shouldReconcileLiveState(null)).toBe(false);
    expect(shouldReconcileLiveState(undefined)).toBe(false);
  });

  it('runs less often than the guest poll so it adds a bounded amount of traffic', () => {
    expect(LIVE_RECONCILE_MS).toBeGreaterThanOrEqual(30_000);
  });
});
