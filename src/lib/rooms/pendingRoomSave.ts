/**
 * A guest's intent to save, carried across authentication.
 *
 * Signing up is not always a callback. A password signup reports back through
 * the form, but a magic link and an OAuth provider both leave the page and
 * return to a fresh one -- the component remounts, every ref and piece of state
 * is gone, and an athlete who already decided to save their result is asked to
 * decide again. That second ask is the one they walk away from.
 *
 * sessionStorage rather than localStorage: the intent belongs to this tab and
 * this visit, and a stale marker in a browser reopened next week should not
 * silently claim a mission.
 */

const PREFIX = 'awf:room-finish-save:';

function key(missionId: string): string {
  return `${PREFIX}${missionId}`;
}

export function markPendingRoomSave(missionId: string): void {
  try {
    window.sessionStorage.setItem(key(missionId), '1');
  } catch {
    // Private mode, or storage disabled. The in-page callback still covers the
    // common path; losing the marker costs a second tap, not the result.
  }
}

export function clearPendingRoomSave(missionId: string): void {
  try {
    window.sessionStorage.removeItem(key(missionId));
  } catch {
    // Nothing to do: a marker we cannot remove is one we could not write.
  }
}

/**
 * Read and consume in one step, so a resume cannot run twice -- a remount, a
 * re-render and the modal's own callback can all arrive for the same intent.
 */
export function takePendingRoomSave(missionId: string): boolean {
  try {
    const found = window.sessionStorage.getItem(key(missionId)) === '1';
    if (found) {
      window.sessionStorage.removeItem(key(missionId));
    }
    return found;
  } catch {
    return false;
  }
}
