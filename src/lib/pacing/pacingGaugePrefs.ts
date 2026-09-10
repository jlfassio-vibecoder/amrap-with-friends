export const PACING_GAUGE_STORAGE_KEY = 'pacingGaugeEnabled';

const memoryFallback = new Map<string, string>();

/**
 * Whether the pacing gauge is shown, remembered across missions.
 *
 * Defaults to **on**: an athlete who has never met it should see it once and
 * decide, rather than have to find a setting to discover a feature exists.
 * Stored per device, like the other view preferences — it is a display choice,
 * not something worth a round trip.
 */
export function readPacingGaugeEnabled(): boolean {
  try {
    const stored = window.localStorage?.getItem(PACING_GAUGE_STORAGE_KEY);
    if (typeof stored === 'string') {
      return stored !== 'false';
    }
  } catch {
    // Ignore storage failures (private browsing, quota, etc.)
  }
  return memoryFallback.get(PACING_GAUGE_STORAGE_KEY) !== 'false';
}

export function writePacingGaugeEnabled(enabled: boolean): void {
  const value = enabled ? 'true' : 'false';
  memoryFallback.set(PACING_GAUGE_STORAGE_KEY, value);
  try {
    window.localStorage?.setItem(PACING_GAUGE_STORAGE_KEY, value);
  } catch {
    // Ignore storage failures (private browsing, quota, etc.)
  }
}

/** Test seam: forget the in-memory fallback between cases. */
export function resetPacingGaugePrefs(): void {
  memoryFallback.clear();
}
