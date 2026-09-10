import { capsForDomain, type MissionTimeCap } from '@/lib/timeDomains';

export interface GetPacingDurationsOptions {
  excludeFirstRound: boolean;
}

/**
 * The lowest clock on which the opening round is treated as a buy-in.
 *
 * Derived from the range table rather than written down, so the rule and the
 * ranges cannot drift apart. It is the floor of the Short domain: every domain
 * except Ultra-Short excludes the buy-in.
 */
const BUY_IN_THRESHOLD_MINUTES: MissionTimeCap = Math.min(...capsForDomain(10));

/**
 * Whether the opening round is excluded from pacing analysis.
 *
 * An opening round is run with full reserves and no feedback yet, so it is
 * almost always the fastest — counting it would mark honest pacing as a
 * collapse. On an Ultra-Short mission there are too few rounds on the clock to
 * discard one, so every round counts there.
 *
 * The old rule was `>= 10`, which was consistent while 10 was the shortest
 * clock in its domain. It is not any more: a 7- and a 10-minute mission are the
 * same kind of effort and must be scored the same way.
 *
 * Non-domain clocks — coach WODs at 6 or 30 minutes — are compared against the
 * same threshold, so the rule is continuous across the gaps in the range table.
 */
export function shouldExcludeBuyInRound(durationMinutes: number): boolean {
  return durationMinutes >= BUY_IN_THRESHOLD_MINUTES;
}

export function getPacingDurations(
  roundSplits: number[],
  options: GetPacingDurationsOptions
): number[] {
  return options.excludeFirstRound ? roundSplits.slice(1) : roundSplits;
}

export function computeAveragePaceSec(durations: number[]): number | null {
  if (durations.length === 0) {
    return null;
  }

  const total = durations.reduce((sum, duration) => sum + duration, 0);
  return total / durations.length;
}
