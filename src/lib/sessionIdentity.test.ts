import { afterEach, describe, it, expect } from 'vitest';
import {
  clearStoredHostToken,
  getStoredHostToken,
  getStoredNickname,
  getStoredParticipantId,
  getStoredClaimToken,
  persistSessionIdentity,
  setStoredHostToken,
} from './sessionIdentity';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
  sessionStorage.clear();
});

describe('persistSessionIdentity', () => {
  it('stores participantId, nickname, and hostToken when a hostToken is given', () => {
    persistSessionIdentity(SESSION_ID, {
      participantId: 'p1',
      nickname: 'Coach',
      hostToken: 'real-host-token',
    });

    expect(getStoredParticipantId(SESSION_ID)).toBe('p1');
    expect(getStoredNickname(SESSION_ID)).toBe('Coach');
    expect(getStoredHostToken(SESSION_ID)).toBe('real-host-token');
  });

  it('clears any stale host token when resolving as a non-host', () => {
    setStoredHostToken(SESSION_ID, 'stale-token');

    persistSessionIdentity(SESSION_ID, {
      participantId: 'p1',
      nickname: 'Athlete',
    });

    expect(getStoredHostToken(SESSION_ID)).toBeNull();
  });

  it('stores a claim token when given', () => {
    persistSessionIdentity(SESSION_ID, {
      participantId: 'p1',
      nickname: 'Athlete',
      claimToken: 'claim-abc',
    });

    expect(getStoredClaimToken(SESSION_ID)).toBe('claim-abc');
  });

  it('is a no-op for host token when resolving without one and none was stored', () => {
    clearStoredHostToken(SESSION_ID);

    persistSessionIdentity(SESSION_ID, {
      participantId: 'p1',
      nickname: 'Athlete',
    });

    expect(getStoredHostToken(SESSION_ID)).toBeNull();
  });
});
