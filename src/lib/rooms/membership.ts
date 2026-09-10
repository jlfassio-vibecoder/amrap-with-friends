/**
 * What each seat in a room may do.
 *
 * The database decides this too -- `room_role()` is checked inside every RPC --
 * and that is the boundary that matters. This exists so the UI can show the
 * right controls without a round trip, and so the rules can be asserted without
 * a database. If the two ever disagree, the RPC wins and this is the bug.
 *
 * The distinctions worth remembering: a co-host runs the room but never touches
 * money, and the platform's own `coach_users` allowlist appears nowhere here. A
 * paying host is not a member of staff.
 */

export type RoomRole = 'owner' | 'cohost' | 'member';

export interface RoomCapabilities {
  /** Publish workouts, schedule missions, run them, react, pin the announcement. */
  runRoom: boolean;
  /** Promote and remove co-hosts. */
  manageCohosts: boolean;
  /** Change billing, transfer ownership, delete the room. */
  manageBilling: boolean;
  /** See referral earnings. Owner only, deliberately. */
  seeEarnings: boolean;
  /** Edit handle, branding and intro. */
  editIdentity: boolean;
  /** Leave. An owner cannot; that is a transfer, which v1 does not have. */
  leave: boolean;
}

const NONE: RoomCapabilities = {
  runRoom: false,
  manageCohosts: false,
  manageBilling: false,
  seeEarnings: false,
  editIdentity: false,
  leave: false,
};

export function capabilitiesFor(role: RoomRole | null | undefined): RoomCapabilities {
  switch (role) {
    case 'owner':
      return {
        runRoom: true,
        manageCohosts: true,
        manageBilling: true,
        seeEarnings: true,
        editIdentity: true,
        leave: false,
      };
    case 'cohost':
      return { ...NONE, runRoom: true, leave: true };
    case 'member':
      return { ...NONE, leave: true };
    default:
      return NONE;
  }
}

/**
 * A revoked co-host drops to participant immediately, including inside a
 * running mission. Callers re-derive from the role they were last told rather
 * than caching what they could do when the mission started.
 */
export function canRunRoom(role: RoomRole | null | undefined): boolean {
  return capabilitiesFor(role).runRoom;
}

export function isRoomHost(role: RoomRole | null | undefined): boolean {
  return role === 'owner' || role === 'cohost';
}
