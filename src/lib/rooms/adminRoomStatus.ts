export interface AdminRoomEntitlement {
  source: string;
  expiresAt: string | null;
}

export interface AdminRoomRow {
  roomId: string;
  handle: string;
  displayName: string;
  createdAt: string;
  hostAccountId: string;
  ownerEmail: string | null;
  memberCount: number;
  isActive: boolean;
  entitlement: AdminRoomEntitlement | null;
}

export type AdminRoomState = 'active' | 'expired' | 'never-granted';

/**
 * Why a room is off, not merely that it is.
 *
 * "Inactive" collapses two situations that need different actions: a host who
 * was never activated is waiting on their first grant, while one whose
 * entitlement lapsed had it and lost it. Showing both as the same red badge is
 * how a founding host quietly sits unactivated for a week.
 */
export function adminRoomState(row: AdminRoomRow): AdminRoomState {
  if (row.isActive) {
    return 'active';
  }
  return row.entitlement === null ? 'never-granted' : 'expired';
}

/** What the row says about itself, in words rather than a colour. */
export function adminRoomStatusLabel(row: AdminRoomRow, now: Date = new Date()): string {
  switch (adminRoomState(row)) {
    case 'active': {
      const expires = row.entitlement?.expiresAt;
      if (!expires) {
        return 'Active';
      }
      const days = Math.ceil((new Date(expires).getTime() - now.getTime()) / 86_400_000);
      // Only when it is close enough to act on. A countdown on every row is
      // noise that makes the one row about to lapse harder to see.
      return days <= 30 ? `Active · expires in ${days} ${days === 1 ? 'day' : 'days'}` : 'Active';
    }
    case 'expired':
      return 'Expired — missions refused';
    case 'never-granted':
      return 'Never activated — missions refused';
  }
}

/**
 * The button's words. Granting to a lapsed host is a renewal and granting to a
 * new one is an activation; calling both "Grant" hides which one you are about
 * to do.
 */
export function adminRoomActionLabel(row: AdminRoomRow): string | null {
  switch (adminRoomState(row)) {
    case 'active':
      return null;
    case 'expired':
      return 'Renew 12 months';
    case 'never-granted':
      return 'Activate 12 months';
  }
}

/**
 * Twelve months from now, which is what the founding-host offer promises.
 *
 * An explicit expiry rather than null: `grant_room_entitlement` rejects a null
 * or infinite one, and a founding grant that never lapses would silently become
 * a free room forever if the pilot ended.
 */
export function foundingExpiry(now: Date = new Date()): string {
  const expires = new Date(now.getTime());
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);
  return expires.toISOString();
}
