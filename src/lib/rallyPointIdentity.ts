import { readIdentityItem, removeIdentityItem, writeIdentityItem } from '@/lib/identityStorage';

const STORAGE_PREFIX = {
  rallyPointIdForMission: 'amrap_rally_point_id',
  rallyPointMemberId: 'amrap_rally_point_member_id',
  rallyPointNickname: 'amrap_rally_point_nickname',
  rallyPointSeatClaim: 'amrap_rally_point_seat_claim',
} as const;

function readItem(prefix: string, id: string): string | null {
  return readIdentityItem(prefix, id);
}

function writeItem(prefix: string, id: string, value: string): void {
  writeIdentityItem(prefix, id, value);
}

export function getStoredRallyPointIdForMission(missionId: string): string | null {
  return readItem(STORAGE_PREFIX.rallyPointIdForMission, missionId);
}

export function setStoredRallyPointIdForMission(missionId: string, rallyPointId: string): void {
  writeItem(STORAGE_PREFIX.rallyPointIdForMission, missionId, rallyPointId);
}

export function getStoredRallyPointMemberId(rallyPointId: string): string | null {
  return readItem(STORAGE_PREFIX.rallyPointMemberId, rallyPointId);
}

export function setStoredRallyPointMemberId(rallyPointId: string, memberId: string): void {
  writeItem(STORAGE_PREFIX.rallyPointMemberId, rallyPointId, memberId);
}

export function getStoredRallyPointSeatClaim(rallyPointId: string): string | null {
  return readItem(STORAGE_PREFIX.rallyPointSeatClaim, rallyPointId);
}

export function setStoredRallyPointSeatClaim(rallyPointId: string, seatClaim: string): void {
  writeItem(STORAGE_PREFIX.rallyPointSeatClaim, rallyPointId, seatClaim);
}

export function getStoredRallyPointNickname(rallyPointId: string): string | null {
  return readItem(STORAGE_PREFIX.rallyPointNickname, rallyPointId);
}

export function setStoredRallyPointNickname(rallyPointId: string, nickname: string): void {
  writeItem(STORAGE_PREFIX.rallyPointNickname, rallyPointId, nickname);
}

export function persistRallyPointIdentity(
  rallyPointId: string,
  input: {
    memberId: string;
    nickname: string;
    missionId?: string | null;
    seatClaim?: string | null;
  }
): void {
  setStoredRallyPointMemberId(rallyPointId, input.memberId);
  setStoredRallyPointNickname(rallyPointId, input.nickname);
  if (input.seatClaim) {
    setStoredRallyPointSeatClaim(rallyPointId, input.seatClaim);
  }
  if (input.missionId) {
    setStoredRallyPointIdForMission(input.missionId, rallyPointId);
  }
}

/**
 * Forgets a rally point seat. Called on a successful leave so a later visit joins as
 * someone new rather than trying to reclaim a seat that is no longer active.
 */
export function clearStoredRallyPointIdentity(rallyPointId: string): void {
  removeIdentityItem(STORAGE_PREFIX.rallyPointMemberId, rallyPointId);
  removeIdentityItem(STORAGE_PREFIX.rallyPointNickname, rallyPointId);
  removeIdentityItem(STORAGE_PREFIX.rallyPointSeatClaim, rallyPointId);
}
