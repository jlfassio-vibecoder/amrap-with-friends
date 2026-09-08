import { readIdentityItem, removeIdentityItem, writeIdentityItem } from '@/lib/identityStorage';

const STORAGE_PREFIX = {
  hostToken: 'amrap_host_token',
  participantId: 'amrap_participant_id',
  claimToken: 'amrap_claim_token',
  nickname: 'amrap_nickname',
  ghost: 'amrap_ghost',
} as const;

function readItem(prefix: string, missionId: string): string | null {
  return readIdentityItem(prefix, missionId);
}

function writeItem(prefix: string, missionId: string, value: string): void {
  writeIdentityItem(prefix, missionId, value);
}

function removeItem(prefix: string, missionId: string): void {
  removeIdentityItem(prefix, missionId);
}

export function getStoredHostToken(missionId: string): string | null {
  return readItem(STORAGE_PREFIX.hostToken, missionId);
}

export function setStoredHostToken(missionId: string, token: string): void {
  writeItem(STORAGE_PREFIX.hostToken, missionId, token);
}

export function clearStoredHostToken(missionId: string): void {
  removeItem(STORAGE_PREFIX.hostToken, missionId);
}

export function getStoredParticipantId(missionId: string): string | null {
  return readItem(STORAGE_PREFIX.participantId, missionId);
}

export function setStoredParticipantId(missionId: string, participantId: string): void {
  writeItem(STORAGE_PREFIX.participantId, missionId, participantId);
}

export function getStoredClaimToken(missionId: string): string | null {
  return readItem(STORAGE_PREFIX.claimToken, missionId);
}

export function setStoredClaimToken(missionId: string, claimToken: string): void {
  writeItem(STORAGE_PREFIX.claimToken, missionId, claimToken);
}

export function clearStoredClaimToken(missionId: string): void {
  removeItem(STORAGE_PREFIX.claimToken, missionId);
}

export function getStoredNickname(missionId: string): string | null {
  return readItem(STORAGE_PREFIX.nickname, missionId);
}

export function setStoredNickname(missionId: string, nickname: string): void {
  writeItem(STORAGE_PREFIX.nickname, missionId, nickname);
}

export function persistMissionIdentity(
  missionId: string,
  identity: {
    nickname: string;
    participantId: string;
    hostToken?: string;
    claimToken?: string;
  }
): void {
  setStoredParticipantId(missionId, identity.participantId);
  setStoredNickname(missionId, identity.nickname);
  if (identity.hostToken) {
    setStoredHostToken(missionId, identity.hostToken);
  } else {
    // Drop stale host authority when reseeding as a non-host (or unknown role).
    clearStoredHostToken(missionId);
  }
  if (identity.claimToken) {
    setStoredClaimToken(missionId, identity.claimToken);
  }
}

export interface StoredGhostSelection {
  missionId: string;
  participantId: string;
  label: string;
  nickname: string;
  finalScore: number;
  baseScore: number;
  createdAt: string;
}

export function getStoredGhostSelection(missionId: string): StoredGhostSelection | null {
  const raw = readItem(STORAGE_PREFIX.ghost, missionId);
  if (!raw || raw === 'none') {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredGhostSelection;
    if (
      typeof parsed.missionId === 'string' &&
      typeof parsed.participantId === 'string' &&
      typeof parsed.label === 'string'
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

export function setStoredGhostSelection(
  missionId: string,
  selection: StoredGhostSelection | null
): void {
  if (!selection) {
    writeItem(STORAGE_PREFIX.ghost, missionId, 'none');
    return;
  }

  writeItem(STORAGE_PREFIX.ghost, missionId, JSON.stringify(selection));
}

export function clearStoredGhostSelection(missionId: string): void {
  removeItem(STORAGE_PREFIX.ghost, missionId);
}

/** RallyPoint display name from email local-part (max 50). */
export function callsignFromEmail(email: string | null | undefined): string | null {
  if (!email) {
    return null;
  }
  const local = email.trim().split('@')[0]?.trim() ?? '';
  if (!local) {
    return null;
  }
  return local.slice(0, 50);
}
