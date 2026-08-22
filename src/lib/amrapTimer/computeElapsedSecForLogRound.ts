import type { AmrapTimerPhase } from './types';

/**
 * Cumulative seconds into the AMRAP work segment for round logging.
 * Uses `workDurationSec - timeLeftSec` (pause-aware when the local clock is synced).
 * For the first round in work, also compares wall time since `workStartedAtMs` so clients
 * who briefly show a full clock while work has actually started do not log ~0 for round 1.
 */
export function computeElapsedSecForLogRound(input: {
  workDurationSec: number;
  timeLeftSec: number;
  phase: AmrapTimerPhase;
  isPaused: boolean;
  workStartedAtMs: number | null;
  roundCountInWork: number;
  nowMs: number;
}): number {
  const {
    workDurationSec,
    timeLeftSec,
    phase,
    isPaused,
    workStartedAtMs,
    roundCountInWork,
    nowMs,
  } = input;

  const fromTimer = Math.max(0, Math.min(workDurationSec, workDurationSec - timeLeftSec));

  if (
    phase !== 'work' ||
    isPaused ||
    workStartedAtMs === null ||
    roundCountInWork > 0
  ) {
    return fromTimer;
  }

  const wallElapsed = Math.floor((nowMs - workStartedAtMs) / 1000);
  const clampedWall = Math.max(0, Math.min(workDurationSec, wallElapsed));

  return Math.max(fromTimer, clampedWall);
}
