/** Dedicated HTMLAudio path for the long vault door — not Web Audio decode. */

export const VAULT_DOOR_URL = '/audio/vault/vault-session-start.mp3';

let door: HTMLAudioElement | null = null;
let playedThisMission = false;

function getDoor(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') {
    return null;
  }
  if (!door) {
    door = new Audio(VAULT_DOOR_URL);
    door.preload = 'auto';
  }
  return door;
}

/** Begin buffering the ~6s door after a user gesture (unlock / first tap). */
export function primeVaultDoor(): void {
  const el = getDoor();
  if (!el) {
    return;
  }
  try {
    el.load();
  } catch {
    // Ignore; play() will still attempt later.
  }
}

/**
 * Play vault-session-start.mp3 from the start.
 * Singleton: cuts off any in-flight copy so fast Log taps do not stutter.
 */
export function playVaultDoor(): boolean {
  const el = getDoor();
  if (!el) {
    return false;
  }
  try {
    el.pause();
    el.currentTime = 0;
    void el.play();
    playedThisMission = true;
    return true;
  } catch {
    return false;
  }
}

export function didPlayVaultDoorThisMission(): boolean {
  return playedThisMission;
}

export function resetVaultDoorMissionFlag(): void {
  playedThisMission = false;
}

export function resetVaultDoorForTests(): void {
  if (door) {
    try {
      door.pause();
    } catch {
      // ignore
    }
  }
  door = null;
  playedThisMission = false;
}
