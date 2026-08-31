const STORAGE_PREFIX = {
  rallyPointIdForSession: 'amrap_rally_point_id',
  rallyPointMemberId: 'amrap_rally_point_member_id',
  rallyPointNickname: 'amrap_rally_point_nickname',
  rallyPointSeatClaim: 'amrap_rally_point_seat_claim',
} as const;

function storageKey(prefix: string, id: string): string {
  return `${prefix}_${id}`;
}

function readItem(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeItem(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* sessionStorage unavailable */
  }
}

export function getStoredRallyPointIdForSession(sessionId: string): string | null {
  return readItem(storageKey(STORAGE_PREFIX.rallyPointIdForSession, sessionId));
}

export function setStoredRallyPointIdForSession(sessionId: string, rallyPointId: string): void {
  writeItem(storageKey(STORAGE_PREFIX.rallyPointIdForSession, sessionId), rallyPointId);
}

export function getStoredRallyPointMemberId(rallyPointId: string): string | null {
  return readItem(storageKey(STORAGE_PREFIX.rallyPointMemberId, rallyPointId));
}

export function setStoredRallyPointMemberId(rallyPointId: string, memberId: string): void {
  writeItem(storageKey(STORAGE_PREFIX.rallyPointMemberId, rallyPointId), memberId);
}

export function getStoredRallyPointSeatClaim(rallyPointId: string): string | null {
  return readItem(storageKey(STORAGE_PREFIX.rallyPointSeatClaim, rallyPointId));
}

export function setStoredRallyPointSeatClaim(rallyPointId: string, seatClaim: string): void {
  writeItem(storageKey(STORAGE_PREFIX.rallyPointSeatClaim, rallyPointId), seatClaim);
}

export function getStoredRallyPointNickname(rallyPointId: string): string | null {
  return readItem(storageKey(STORAGE_PREFIX.rallyPointNickname, rallyPointId));
}

export function setStoredRallyPointNickname(rallyPointId: string, nickname: string): void {
  writeItem(storageKey(STORAGE_PREFIX.rallyPointNickname, rallyPointId), nickname);
}

export function persistRallyPointIdentity(
  rallyPointId: string,
  input: {
    memberId: string;
    nickname: string;
    sessionId?: string | null;
    seatClaim?: string | null;
  }
): void {
  setStoredRallyPointMemberId(rallyPointId, input.memberId);
  setStoredRallyPointNickname(rallyPointId, input.nickname);
  if (input.seatClaim) {
    setStoredRallyPointSeatClaim(rallyPointId, input.seatClaim);
  }
  if (input.sessionId) {
    setStoredRallyPointIdForSession(input.sessionId, rallyPointId);
  }
}

/**
 * Forgets a rally point seat. Called on a successful leave so a later visit joins as
 * someone new rather than trying to reclaim a seat that is no longer active.
 */
export function clearStoredRallyPointIdentity(rallyPointId: string): void {
  try {
    sessionStorage.removeItem(storageKey(STORAGE_PREFIX.rallyPointMemberId, rallyPointId));
    sessionStorage.removeItem(storageKey(STORAGE_PREFIX.rallyPointNickname, rallyPointId));
    sessionStorage.removeItem(storageKey(STORAGE_PREFIX.rallyPointSeatClaim, rallyPointId));
  } catch {
    /* sessionStorage unavailable */
  }
}
