import type { AmrapTimerPhase } from './types';

/**
 * Cumulative seconds into the AMRAP work segment for round logging.
 *
 * `workDurationSec - timeLeftSec` only moves once a second, so it is behind the
 * real clock by up to a full second at the instant the button is pressed — the
 * athlete's split is banked short and the next one long. When the caller knows
 * how the work segment has actually been spent (`workStartedAtMs` plus the
 * milliseconds banked in pauses) the wall clock is the better number, and it is
 * never smaller than the tick-derived one, because both floor the same instant.
 *
 * `pausedAccumMs` is null for a joiner, whose display is reconciled from the
 * host's pushes and carries no pause ledger. Wall time there would count paused
 * seconds as work, so that caller keeps the tick-derived value.
 */
export function computeElapsedSecForLogRound(input: {
  workDurationSec: number;
  timeLeftSec: number;
  phase: AmrapTimerPhase;
  isPaused: boolean;
  workStartedAtMs: number | null;
  /** Milliseconds banked in closed pauses, or null when the caller cannot know. */
  pausedAccumMs: number | null;
  nowMs: number;
}): number {
  const { workDurationSec, timeLeftSec, phase, isPaused, workStartedAtMs, pausedAccumMs, nowMs } =
    input;

  const fromTimer = Math.max(0, Math.min(workDurationSec, workDurationSec - timeLeftSec));

  if (phase !== 'work' || isPaused || workStartedAtMs === null || pausedAccumMs === null) {
    return fromTimer;
  }

  const wallElapsed = Math.floor((nowMs - workStartedAtMs - pausedAccumMs) / 1000);
  const clampedWall = Math.max(0, Math.min(workDurationSec, wallElapsed));

  return Math.max(fromTimer, clampedWall);
}
