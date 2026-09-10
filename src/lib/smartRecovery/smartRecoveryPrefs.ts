export const SMART_RECOVERY_STORAGE_KEY = 'smartRecoveryEnabled';

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

export function readSmartRecoveryEnabled(): boolean {
  return readPref(SMART_RECOVERY_STORAGE_KEY) === 'true';
}

export function writeSmartRecoveryEnabled(enabled: boolean): void {
  writePref(SMART_RECOVERY_STORAGE_KEY, enabled ? 'true' : 'false');
}

export function resetSmartRecoveryPrefs(): void {
  memoryFallback.clear();
  try {
    window.localStorage?.removeItem(SMART_RECOVERY_STORAGE_KEY);
  } catch {
    // Ignore storage failures (private browsing, quota, etc.)
  }
}
