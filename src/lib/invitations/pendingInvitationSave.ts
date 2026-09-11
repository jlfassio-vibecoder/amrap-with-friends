/**
 * A guest's intent to save a chat invitation to Sent to you, carried across
 * sign-in. Same pattern as pending room-finish save: sessionStorage so a stale
 * marker next week cannot silently claim an invitation.
 */

const PREFIX = 'awf:pending-invitation-save:';

function key(invitationId: string): string {
  return `${PREFIX}${invitationId}`;
}

export function markPendingInvitationSave(invitationId: string): void {
  try {
    window.sessionStorage.setItem(key(invitationId), '1');
  } catch {
    // Private mode. The in-page auth callback still covers the common path.
  }
}

export function takePendingInvitationSave(invitationId: string): boolean {
  try {
    const found = window.sessionStorage.getItem(key(invitationId)) === '1';
    if (found) {
      window.sessionStorage.removeItem(key(invitationId));
    }
    return found;
  } catch {
    return false;
  }
}

export function listPendingInvitationSaves(): string[] {
  try {
    const ids: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const storageKey = window.sessionStorage.key(i);
      if (storageKey && storageKey.startsWith(PREFIX)) {
        ids.push(storageKey.slice(PREFIX.length));
      }
    }
    return ids;
  } catch {
    return [];
  }
}
