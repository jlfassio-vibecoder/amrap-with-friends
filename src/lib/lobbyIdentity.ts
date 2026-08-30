const STORAGE_PREFIX = {
  lobbyIdForSession: 'amrap_lobby_id',
  lobbyMemberId: 'amrap_lobby_member_id',
  lobbyNickname: 'amrap_lobby_nickname',
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

export function getStoredLobbyIdForSession(sessionId: string): string | null {
  return readItem(storageKey(STORAGE_PREFIX.lobbyIdForSession, sessionId));
}

export function setStoredLobbyIdForSession(sessionId: string, lobbyId: string): void {
  writeItem(storageKey(STORAGE_PREFIX.lobbyIdForSession, sessionId), lobbyId);
}

export function getStoredLobbyMemberId(lobbyId: string): string | null {
  return readItem(storageKey(STORAGE_PREFIX.lobbyMemberId, lobbyId));
}

export function setStoredLobbyMemberId(lobbyId: string, memberId: string): void {
  writeItem(storageKey(STORAGE_PREFIX.lobbyMemberId, lobbyId), memberId);
}

export function getStoredLobbyNickname(lobbyId: string): string | null {
  return readItem(storageKey(STORAGE_PREFIX.lobbyNickname, lobbyId));
}

export function setStoredLobbyNickname(lobbyId: string, nickname: string): void {
  writeItem(storageKey(STORAGE_PREFIX.lobbyNickname, lobbyId), nickname);
}

export function persistLobbyIdentity(
  lobbyId: string,
  input: { memberId: string; nickname: string; sessionId?: string | null }
): void {
  setStoredLobbyMemberId(lobbyId, input.memberId);
  setStoredLobbyNickname(lobbyId, input.nickname);
  if (input.sessionId) {
    setStoredLobbyIdForSession(input.sessionId, lobbyId);
  }
}
