export interface GetPacingDurationsOptions {
  excludeFirstRound: boolean;
}

export function shouldExcludeBuyInRound(durationMinutes: number): boolean {
  return durationMinutes >= 10;
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
