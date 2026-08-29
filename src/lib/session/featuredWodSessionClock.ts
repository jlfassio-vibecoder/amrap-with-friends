import { DEFAULT_SETUP_DURATION_SEC } from '@/lib/amrapTimer/constants';
import type { LiveSessionPhase } from '@/lib/sessionSync/types';

/** Setup length used when a featured session is manually started (host Start). */
export const FEATURED_SETUP_DURATION_SEC = DEFAULT_SETUP_DURATION_SEC;

export interface FeaturedSessionClock {
  phase: LiveSessionPhase;
  timeLeftSec: number;
  workStartedAtMs: number | null;
}

/**
 * Wall-clock remaining for a featured session that has already left waiting
 * (host Start). Does not invent setup/work from scheduled_at alone — callers
 * must only use this once authoritative state is setup/work/finished.
 */
export function computeFeaturedSessionClock(input: {
  scheduledAtMs: number;
  durationMinutes: number;
  nowMs: number;
  setupDurationSec?: number;
}): FeaturedSessionClock {
  const setupDurationSec = input.setupDurationSec ?? FEATURED_SETUP_DURATION_SEC;
  const workDurationSec = input.durationMinutes * 60;
  const setupEndsAtMs = input.scheduledAtMs + setupDurationSec * 1000;
  const workEndsAtMs = setupEndsAtMs + workDurationSec * 1000;

  if (input.nowMs < input.scheduledAtMs) {
    return {
      phase: 'waiting',
      timeLeftSec: setupDurationSec,
      workStartedAtMs: null,
    };
  }

  if (input.nowMs < setupEndsAtMs) {
    const timeLeftSec = Math.max(
      1,
      Math.ceil((setupEndsAtMs - input.nowMs) / 1000)
    );
    return {
      phase: 'setup',
      timeLeftSec,
      workStartedAtMs: null,
    };
  }

  if (input.nowMs < workEndsAtMs) {
    const elapsedWorkSec = Math.floor((input.nowMs - setupEndsAtMs) / 1000);
    return {
      phase: 'work',
      timeLeftSec: Math.max(0, workDurationSec - elapsedWorkSec),
      workStartedAtMs: setupEndsAtMs,
    };
  }

  return {
    phase: 'finished',
    timeLeftSec: 0,
    workStartedAtMs: setupEndsAtMs,
  };
}
