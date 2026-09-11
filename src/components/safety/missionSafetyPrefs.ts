const MISSION_DONE_VALUE = '1';
const memoryFallback = new Map<string, string>();

export function missionSafetyCompleteKey(missionId: string): string {
  return `amrap_mission_safety_v1_${missionId}`;
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

export function isMissionSafetyComplete(missionId: string): boolean {
  if (!missionId) {
    return false;
  }
  return readPref(missionSafetyCompleteKey(missionId)) === MISSION_DONE_VALUE;
}

export function markMissionSafetyComplete(missionId: string): void {
  if (!missionId) {
    return;
  }
  writePref(missionSafetyCompleteKey(missionId), MISSION_DONE_VALUE);
}

/** For tests only — resets in-memory fallback and localStorage entries. */
export function resetMissionSafetyPrefs(): void {
  memoryFallback.clear();
  try {
    const storage = window.localStorage;
    if (!storage) {
      return;
    }
    const toRemove: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key?.startsWith('amrap_mission_safety_v1_')) {
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
