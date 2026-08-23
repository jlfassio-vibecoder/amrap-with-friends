const STORAGE_PREFIX = {
  hostToken: 'amrap_host_token',
  participantId: 'amrap_participant_id',
  claimToken: 'amrap_claim_token',
  nickname: 'amrap_nickname',
} as const;

function storageKey(prefix: string, sessionId: string): string {
  return `${prefix}_${sessionId}`;
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

export function getStoredHostToken(sessionId: string): string | null {
  return readItem(storageKey(STORAGE_PREFIX.hostToken, sessionId));
}

export function setStoredHostToken(sessionId: string, token: string): void {
  writeItem(storageKey(STORAGE_PREFIX.hostToken, sessionId), token);
}

export function getStoredParticipantId(sessionId: string): string | null {
  return readItem(storageKey(STORAGE_PREFIX.participantId, sessionId));
}

export function setStoredParticipantId(sessionId: string, participantId: string): void {
  writeItem(storageKey(STORAGE_PREFIX.participantId, sessionId), participantId);
}

export function getStoredClaimToken(sessionId: string): string | null {
  return readItem(storageKey(STORAGE_PREFIX.claimToken, sessionId));
}

export function setStoredClaimToken(sessionId: string, claimToken: string): void {
  writeItem(storageKey(STORAGE_PREFIX.claimToken, sessionId), claimToken);
}

export function clearStoredClaimToken(sessionId: string): void {
  try {
    sessionStorage.removeItem(storageKey(STORAGE_PREFIX.claimToken, sessionId));
  } catch {
    /* sessionStorage unavailable */
  }
}

export function getStoredNickname(sessionId: string): string | null {
  return readItem(storageKey(STORAGE_PREFIX.nickname, sessionId));
}

export function setStoredNickname(sessionId: string, nickname: string): void {
  writeItem(storageKey(STORAGE_PREFIX.nickname, sessionId), nickname);
}

export function persistSessionIdentity(
  sessionId: string,
  identity: {
    nickname: string;
    participantId: string;
    hostToken?: string;
    claimToken?: string;
  }
): void {
  setStoredParticipantId(sessionId, identity.participantId);
  setStoredNickname(sessionId, identity.nickname);
  if (identity.hostToken) {
    setStoredHostToken(sessionId, identity.hostToken);
  }
  if (identity.claimToken) {
    setStoredClaimToken(sessionId, identity.claimToken);
  }
}
