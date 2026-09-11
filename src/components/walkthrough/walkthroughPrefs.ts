import type { WalkthroughRole } from './rallyPointWalkthrough';

const STORAGE_KEYS: Record<WalkthroughRole, string> = {
  host: 'amrap_rally_point_walkthrough_v1_host',
  joiner: 'amrap_rally_point_walkthrough_v1_joiner',
};

const DISMISSED_VALUE = 'dismissed';
const MISSION_DONE_VALUE = '1';
const memoryFallback = new Map<string, string>();

export function walkthroughStorageKey(role: WalkthroughRole): string {
  return STORAGE_KEYS[role];
}

export function walkthroughMissionCompleteKey(missionId: string, role: WalkthroughRole): string {
  return `amrap_rally_point_walkthrough_v1_mission_${role}_${missionId}`;
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

/** True when this mission's tour (or finale) was finished for this role. */
export function isWalkthroughCompleteForMission(missionId: string, role: WalkthroughRole): boolean {
  if (!missionId) {
    return false;
  }
  return readPref(walkthroughMissionCompleteKey(missionId, role)) === MISSION_DONE_VALUE;
}

/** Remember that the tour was finished for this mission so refresh does not replay it. */
export function markWalkthroughCompleteForMission(missionId: string, role: WalkthroughRole): void {
  if (!missionId) {
    return;
  }
  writePref(walkthroughMissionCompleteKey(missionId, role), MISSION_DONE_VALUE);
}

export function resetWalkthroughPrefs(): void {
  memoryFallback.clear();
  try {
    window.localStorage?.removeItem(STORAGE_KEYS.host);
    window.localStorage?.removeItem(STORAGE_KEYS.joiner);
    const storage = window.localStorage;
    if (!storage) {
      return;
    }
    const toRemove: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key?.startsWith('amrap_rally_point_walkthrough_v1_mission_')) {
        toRemove.push(key);
      }
    }
    for (const key of toRemove) {
      storage.removeItem(key);
    }
  } catch {
    // Ignore storage failures (private browsing, quota, etc.)
  }
}
