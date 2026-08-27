import type { WalkthroughRole } from './stagingWalkthrough';

const STORAGE_KEYS: Record<WalkthroughRole, string> = {
  host: 'amrap_staging_walkthrough_v1_host',
  joiner: 'amrap_staging_walkthrough_v1_joiner',
};

const DISMISSED_VALUE = 'dismissed';
const memoryFallback = new Map<string, string>();

export function walkthroughStorageKey(role: WalkthroughRole): string {
  return STORAGE_KEYS[role];
}

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

export function isWalkthroughDismissed(role: WalkthroughRole): boolean {
  return readPref(STORAGE_KEYS[role]) === DISMISSED_VALUE;
}

export function dismissWalkthroughForever(role: WalkthroughRole): void {
  writePref(STORAGE_KEYS[role], DISMISSED_VALUE);
}

export function resetWalkthroughPrefs(): void {
  memoryFallback.clear();
  try {
    window.localStorage?.removeItem(STORAGE_KEYS.host);
    window.localStorage?.removeItem(STORAGE_KEYS.joiner);
  } catch {
    // Ignore storage failures (private browsing, quota, etc.)
  }
}
