const STORAGE_PREFIX = {
  hostToken: 'amrap_host_token',
  participantId: 'amrap_participant_id',
  claimToken: 'amrap_claim_token',
  nickname: 'amrap_nickname',
  ghost: 'amrap_ghost',
} as const;

function storageKey(prefix: string, missionId: string): string {
  return `${prefix}_${missionId}`;
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

export function getStoredHostToken(missionId: string): string | null {
  return readItem(storageKey(STORAGE_PREFIX.hostToken, missionId));
}

export function setStoredHostToken(missionId: string, token: string): void {
  writeItem(storageKey(STORAGE_PREFIX.hostToken, missionId), token);
}

export function clearStoredHostToken(missionId: string): void {
  try {
    sessionStorage.removeItem(storageKey(STORAGE_PREFIX.hostToken, missionId));
  } catch {
    /* sessionStorage unavailable */
  }
}

export function getStoredParticipantId(missionId: string): string | null {
  return readItem(storageKey(STORAGE_PREFIX.participantId, missionId));
}

export function setStoredParticipantId(missionId: string, participantId: string): void {
  writeItem(storageKey(STORAGE_PREFIX.participantId, missionId), participantId);
}

export function getStoredClaimToken(missionId: string): string | null {
  return readItem(storageKey(STORAGE_PREFIX.claimToken, missionId));
}

export function setStoredClaimToken(missionId: string, claimToken: string): void {
  writeItem(storageKey(STORAGE_PREFIX.claimToken, missionId), claimToken);
}

export function clearStoredClaimToken(missionId: string): void {
  try {
    sessionStorage.removeItem(storageKey(STORAGE_PREFIX.claimToken, missionId));
  } catch {
    /* sessionStorage unavailable */
  }
}

export function getStoredNickname(missionId: string): string | null {
  return readItem(storageKey(STORAGE_PREFIX.nickname, missionId));
}

export function setStoredNickname(missionId: string, nickname: string): void {
  writeItem(storageKey(STORAGE_PREFIX.nickname, missionId), nickname);
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
  const raw = readItem(storageKey(STORAGE_PREFIX.ghost, missionId));
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
    writeItem(storageKey(STORAGE_PREFIX.ghost, missionId), 'none');
    return;
  }

  writeItem(storageKey(STORAGE_PREFIX.ghost, missionId), JSON.stringify(selection));
}

export function clearStoredGhostSelection(missionId: string): void {
  try {
    sessionStorage.removeItem(storageKey(STORAGE_PREFIX.ghost, missionId));
  } catch {
    /* sessionStorage unavailable */
  }
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
