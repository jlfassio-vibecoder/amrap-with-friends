import { describe, expect, it } from 'vitest';
import {
  LOG_ROUND_COOLDOWN_ALERT,
  LOG_ROUND_COOLDOWN_MS,
  canLogRound,
} from '@/lib/mission/logRoundCooldown';

describe('canLogRound', () => {
  it('allows the first log with no prior stamp', () => {
    expect(canLogRound(null, 1_000)).toBe(true);
  });

  it('blocks a second log inside the cooldown window', () => {
    expect(canLogRound(1_000, 1_000 + LOG_ROUND_COOLDOWN_MS - 1)).toBe(false);
  });

  it('allows a log once the cooldown has elapsed', () => {
    expect(canLogRound(1_000, 1_000 + LOG_ROUND_COOLDOWN_MS)).toBe(true);
  });

  it('keeps the athlete-facing alert copy stable', () => {
    expect(LOG_ROUND_COOLDOWN_ALERT).toBe('Round logged, continue next round');
  });
});
