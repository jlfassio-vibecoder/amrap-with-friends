import { getPacingDurations } from '@/lib/scoring/getPacingDurations';

export interface ComputePviOptions {
  excludeFirstRound: boolean;
}

export function computePvi(
  roundDurationsSec: number[],
  options: ComputePviOptions
): number | null {
  const durations = getPacingDurations(roundDurationsSec, options);

  if (durations.length < 2) {
    return null;
  }

  const fastest = Math.min(...durations);
  const slowest = Math.max(...durations);
  const average = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;

  if (average === 0) {
    return null;
  }

  const pvi = ((slowest - fastest) / average) * 100;
  return Math.round(pvi * 10) / 10;
}
