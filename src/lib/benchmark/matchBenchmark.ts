import type { AthleteBenchmark } from '@/lib/api/benchmarks';

/**
 * The benchmark a mission belongs to, if any.
 *
 * Matched on the workout and the clock, not on the mission — a benchmark is a
 * workout you come back to, so every run of it wears the badge, including the
 * ones from before it was designated. That is the same call the attempt
 * derivation makes: what you scored on that workout at that clock is the
 * measurement, whether or not a button was pressed first.
 *
 * An active benchmark wins over a retired one on the same workout, so a mission
 * is never labelled from a benchmark the athlete has since replaced.
 */
export function benchmarkForMission(
  mission: { templateId: string | null; durationMinutes: number },
  benchmarks: readonly AthleteBenchmark[]
): AthleteBenchmark | null {
  if (mission.templateId === null) {
    return null;
  }

  const matches = benchmarks.filter(
    (benchmark) =>
      benchmark.templateId === mission.templateId &&
      benchmark.durationMinutes === mission.durationMinutes
  );

  if (matches.length === 0) {
    return null;
  }

  return matches.find((benchmark) => benchmark.retiredAt === null) ?? matches[0];
}
