const STORAGE_KEY = 'amrap:guided_ignition_v1';
const COMPLETED_VALUE = 'completed';
const memoryFallback = new Map<string, string>();

function readPref(key: string): string | null {
  try {
    const stored = window.localStorage?.getItem(key);
    if (typeof stored === 'string') {
      return stored;
    }
  } catch {
    // Ignore storage failures (private browsing, quota, etc.)
  }
  return memoryFallback.get(key) ?? null;
}

function writePref(key: string, value: string): void {
  memoryFallback.set(key, value);
  try {
    window.localStorage?.setItem(key, value);
  } catch {
    // Ignore storage failures (private browsing, quota, etc.)
  }
}

export function hasCompletedGuidedIgnition(): boolean {
  return readPref(STORAGE_KEY) === COMPLETED_VALUE;
}

export function markGuidedIgnitionComplete(): void {
  writePref(STORAGE_KEY, COMPLETED_VALUE);
}

/** For tests only — resets in-memory fallback and localStorage entry. */
export function resetGuidedIgnitionPrefs(): void {
  memoryFallback.clear();
  try {
    window.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures (private browsing, quota, etc.)
  }
}
