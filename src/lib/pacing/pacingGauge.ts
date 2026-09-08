/**
 * The live pacing gauge: this round's elapsed time against the benchmark set by
 * round one.
 *
 * **A caveat worth reading before trusting the needle.** This product already
 * has a considered position on the opening round, in `getPacingDurations.ts`:
 * on every clock of 7 minutes or more it is excluded from pacing analysis,
 * because "an opening round is run with full reserves and no feedback yet, so
 * it is almost always the fastest — counting it would mark honest pacing as a
 * collapse." That is exactly what this gauge does by design: it measures every
 * later round against the freshest one. On a 20-minute mission most athletes
 * will sit in the red from round three onward while pacing perfectly well, and
 * the gauge will disagree with the PVI band the same mission reports at the
 * end.
 *
 * That is the specified behaviour and it is implemented as specified. The
 * benchmark is derived in one function (`benchmarkFromSplits`) so a different
 * rule — the median of the first two rounds, say, or the buy-in-excluded
 * average the scoring already uses — is a change in one place.
 */

/** Below this, the athlete is inside their round-one pace. */
export const OPTIMAL_CEILING = 0.9;

export type PacingZone = 'optimal' | 'warning' | 'overtime';

export interface PacingGaugeState {
  /** Round one's duration, in seconds. Null until round one is logged. */
  benchmarkSec: number | null;
  /** Time spent in the round currently being worked. */
  roundElapsedSec: number;
  /**
   * `roundElapsedSec / benchmarkSec`, clamped at the top only.
   *
   * Uncapped above 1 would send the needle off the dial on a long stall; the
   * overtime number carries that information instead, exactly, in seconds.
   */
  ratio: number;
  zone: PacingZone;
  /** Seconds past the benchmark; 0 until the benchmark is exceeded. */
  overtimeSec: number;
  /** True once there is a benchmark and a round in progress to measure. */
  isActive: boolean;
}

/** The furthest the needle travels: one full benchmark plus a visible overrun. */
export const MAX_RATIO = 1.25;

/**
 * Round one's duration.
 *
 * Splits are cumulative elapsed-at-round values, so the first split *is* the
 * first round's duration. Returns null before round one is logged, and for a
 * zero-length first split, which would make every later ratio infinite.
 */
export function benchmarkFromSplits(roundSplitsSec: readonly number[]): number | null {
  const first = roundSplitsSec[0];
  if (typeof first !== 'number' || !Number.isFinite(first) || first <= 0) {
    return null;
  }
  return first;
}

export function zoneForRatio(ratio: number): PacingZone {
  if (ratio > 1) {
    return 'overtime';
  }
  if (ratio >= OPTIMAL_CEILING) {
    return 'warning';
  }
  return 'optimal';
}

export function computePacingGaugeState(input: {
  /** Cumulative elapsed-at-round seconds, oldest first. */
  roundSplitsSec: readonly number[];
  /** Mission elapsed seconds — the same clock the athlete is reading. */
  elapsedSec: number;
}): PacingGaugeState {
  const benchmarkSec = benchmarkFromSplits(input.roundSplitsSec);
  const lastSplit = input.roundSplitsSec[input.roundSplitsSec.length - 1] ?? 0;
  // Never negative: a joiner's round can arrive over realtime a tick before
  // their clock catches up, which would otherwise read as a round that started
  // in the future.
  const roundElapsedSec = Math.max(0, input.elapsedSec - lastSplit);

  if (benchmarkSec === null) {
    return {
      benchmarkSec: null,
      roundElapsedSec,
      ratio: 0,
      zone: 'optimal',
      overtimeSec: 0,
      isActive: false,
    };
  }

  const rawRatio = roundElapsedSec / benchmarkSec;

  return {
    benchmarkSec,
    roundElapsedSec,
    ratio: Math.min(MAX_RATIO, rawRatio),
    zone: zoneForRatio(rawRatio),
    overtimeSec: Math.max(0, roundElapsedSec - benchmarkSec),
    isActive: true,
  };
}

/** "+0:05" once past the benchmark, otherwise the time still in hand. */
export function formatPacingReadout(state: PacingGaugeState): string {
  if (state.benchmarkSec === null) {
    return '—';
  }

  const seconds =
    state.overtimeSec > 0 ? state.overtimeSec : state.benchmarkSec - state.roundElapsedSec;
  const sign = state.overtimeSec > 0 ? '+' : '';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${sign}${minutes}:${String(remainder).padStart(2, '0')}`;
}

/** What the readout means, for the label beside it and for screen readers. */
export function pacingReadoutLabel(state: PacingGaugeState): string {
  if (state.benchmarkSec === null) {
    return 'Round 1 sets the benchmark';
  }
  return state.overtimeSec > 0 ? 'past round 1' : 'left of round 1';
}
