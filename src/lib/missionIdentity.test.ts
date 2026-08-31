import { afterEach, describe, it, expect } from 'vitest';
import {
  clearStoredHostToken,
  getStoredHostToken,
  getStoredNickname,
  getStoredParticipantId,
  getStoredClaimToken,
  persistMissionIdentity,
  setStoredHostToken,
} from './missionIdentity';

const MISSION_ID = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
  sessionStorage.clear();
});

describe('persistMissionIdentity', () => {
  it('stores participantId, nickname, and hostToken when a hostToken is given', () => {
    persistMissionIdentity(MISSION_ID, {
      participantId: 'p1',
      nickname: 'Coach',
      hostToken: 'real-host-token',
    });

    expect(getStoredParticipantId(MISSION_ID)).toBe('p1');
    expect(getStoredNickname(MISSION_ID)).toBe('Coach');
    expect(getStoredHostToken(MISSION_ID)).toBe('real-host-token');
  });

  it('clears any stale host token when resolving as a non-host', () => {
    setStoredHostToken(MISSION_ID, 'stale-token');

    persistMissionIdentity(MISSION_ID, {
      participantId: 'p1',
      nickname: 'Athlete',
    });

    expect(getStoredHostToken(MISSION_ID)).toBeNull();
  });

  it('stores a claim token when given', () => {
    persistMissionIdentity(MISSION_ID, {
      participantId: 'p1',
      nickname: 'Athlete',
      claimToken: 'claim-abc',
    });

    expect(getStoredClaimToken(MISSION_ID)).toBe('claim-abc');
  });

  it('is a no-op for host token when resolving without one and none was stored', () => {
    clearStoredHostToken(MISSION_ID);

    persistMissionIdentity(MISSION_ID, {
      participantId: 'p1',
      nickname: 'Athlete',
    });

    expect(getStoredHostToken(MISSION_ID)).toBeNull();
  });
});
