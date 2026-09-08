/**
 * When a retest is due.
 *
 * > **≥28 days since the last attempt, AND ≥8 missions logged since it.**
 * > Both, whichever lands later.
 *
 * **28 days** because that is roughly how long a training stimulus takes to
 * show up as adaptation. Testing sooner measures noise, freshness and how well
 * you slept, and a benchmark that moves for those reasons teaches nothing.
 *
 * **8 missions** because 28 days in which you trained twice is not 28 days of
 * training. The product's own range is 1–5 missions a week, so 8 missions is
 * between 2 and 8 weeks of real work.
 *
 * Together they self-adjust: someone training five times a week retests at four
 * weeks, someone training once a week at eight, and nobody tests before four.
 * No special case for either.
 *
 * The count is any mission, not only missions in the same domain. General
 * training is what drives the adaptation, and counting only same-domain
 * missions would push athletes toward training the test instead of training.
 */

export const RETEST_MIN_DAYS = 28;
export const RETEST_MIN_MISSIONS = 8;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type BenchmarkStatus =
  /** Designated, never yet run the way it is measured. */
  | { state: 'no-baseline' }
  | { state: 'due' }
  | {
      state: 'waiting';
      daysRemaining: number;
      missionsRemaining: number;
      /** Days until clear, else missions — days first when both remain. */
      binding: 'days' | 'missions';
    };

export function benchmarkStatus(input: {
  /** ISO instant of the most recent same-version attempt; null if never. */
  lastAttemptAt: string | null;
  /** Scored missions of any kind since that attempt. */
  missionsSince: number;
  now: number;
}): BenchmarkStatus {
  if (input.lastAttemptAt === null) {
    return { state: 'no-baseline' };
  }

  const lastAt = Date.parse(input.lastAttemptAt);
  if (Number.isNaN(lastAt)) {
    return { state: 'no-baseline' };
  }

  const daysElapsed = Math.floor((input.now - lastAt) / MS_PER_DAY);
  const daysRemaining = Math.max(0, RETEST_MIN_DAYS - daysElapsed);
  const missionsRemaining = Math.max(0, RETEST_MIN_MISSIONS - input.missionsSince);

  if (daysRemaining === 0 && missionsRemaining === 0) {
    return { state: 'due' };
  }

  return {
    state: 'waiting',
    daysRemaining,
    missionsRemaining,
    // Name whichever gate is actually holding it up, so the athlete knows what
    // to do about it: wait, or train. "Not yet" tells them neither.
    binding: missionsRemaining > 0 && daysRemaining === 0 ? 'missions' : 'days',
  };
}

/** Scored missions logged strictly after an attempt, counted for the gate. */
export function missionsSince(
  lastAttemptAt: string | null,
  missions: ReadonlyArray<{ at: string; scored: boolean }>
): number {
  if (lastAttemptAt === null) {
    return 0;
  }
  const lastAt = Date.parse(lastAttemptAt);
  if (Number.isNaN(lastAt)) {
    return 0;
  }
  return missions.filter((mission) => mission.scored && Date.parse(mission.at) > lastAt).length;
}

/** "Retest due" / "Retest in 11 days" / "Retest in 5 missions". */
export function formatBenchmarkStatus(status: BenchmarkStatus): string {
  if (status.state === 'no-baseline') {
    return 'Run it to set your baseline';
  }
  if (status.state === 'due') {
    return 'Retest due';
  }
  if (status.binding === 'missions') {
    return status.missionsRemaining === 1
      ? 'Retest in 1 mission'
      : `Retest in ${status.missionsRemaining} missions`;
  }
  return status.daysRemaining === 1 ? 'Retest in 1 day' : `Retest in ${status.daysRemaining} days`;
}
