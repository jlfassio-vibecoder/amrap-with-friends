export interface MissedRoundInput {
  /** Cumulative work seconds at the last logged round; 0 when none is logged yet. */
  previousElapsedSec: number;
  /** Cumulative work seconds now, when the athlete noticed the log was missed. */
  nowElapsedSec: number;
  /** Total reps in one full round of this workout. 0 when the workout is not countable. */
  repsPerRound: number;
  /** Reps of the *next* round already completed when they noticed. */
  repsIntoNextRound: number;
}

export interface MissedRoundEstimate {
  /** Where the missed round actually ended, in cumulative work seconds. */
  elapsedSecAtRound: number;
  /** The split this produces for the missed round. */
  missedRoundSplitSec: number;
  /** What the athlete has banked toward the round they are in now. */
  carriedSplitSec: number;
  /** Seconds recovered versus logging late at `nowElapsedSec`. */
  correctionSec: number;
  /** True when the reps given cannot place the boundary and the estimate is just "now". */
  isUncorrected: boolean;
}

/**
 * Reconstructs when a missed round actually ended.
 *
 * The window between the last logged round and now contains one whole round
 * plus however many reps of the next one the athlete had done before noticing.
 * Splitting that window in proportion to reps — assuming an even pace across
 * it, which is the only thing we can know — puts the boundary back where it
 * belongs.
 *
 * This matters more than it looks: PVI is (slowest - fastest) / average, so a
 * late log inflates one split and deflates the next, hitting both ends of that
 * ratio at once. One forgotten button press can drop a mission from Elite
 * Pacing to System Failure.
 */
export function computeMissedRoundElapsedSec(input: MissedRoundInput): MissedRoundEstimate {
  const { previousElapsedSec, nowElapsedSec, repsPerRound, repsIntoNextRound } = input;

  const previous = Math.max(0, Math.floor(previousElapsedSec));
  const now = Math.max(previous, Math.floor(nowElapsedSec));
  const windowSec = now - previous;

  const uncorrected: MissedRoundEstimate = {
    elapsedSecAtRound: now,
    missedRoundSplitSec: windowSec,
    carriedSplitSec: 0,
    correctionSec: 0,
    isUncorrected: true,
  };

  // Without a rep count per round there is no ratio to split the window by, and
  // without a window there is nothing to split.
  if (!Number.isFinite(repsPerRound) || repsPerRound <= 0 || windowSec <= 0) {
    return uncorrected;
  }

  // More than a full round of overshoot is not a missed log any more — it is a
  // second round the athlete should log on its own.
  const reps = Math.min(Math.max(0, Math.floor(repsIntoNextRound)), repsPerRound);
  if (reps === 0) {
    return uncorrected;
  }

  const boundary = previous + (windowSec * repsPerRound) / (repsPerRound + reps);

  // Keep the missed round at least a second long, and never let the correction
  // run past the moment it was reported.
  const elapsedSecAtRound = Math.min(now, Math.max(previous + 1, Math.round(boundary)));

  return {
    elapsedSecAtRound,
    missedRoundSplitSec: elapsedSecAtRound - previous,
    carriedSplitSec: now - elapsedSecAtRound,
    correctionSec: now - elapsedSecAtRound,
    isUncorrected: false,
  };
}
