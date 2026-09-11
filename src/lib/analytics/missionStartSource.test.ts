import { describe, expect, it } from 'vitest';
import {
  isWaitingRoomPresenceState,
  rallyPointStayDurationSec,
  resolveMissionStartSource,
} from './missionStartSource';

describe('resolveMissionStartSource', () => {
  it('returns immediate when neither countdown nor chain apply', () => {
    expect(resolveMissionStartSource({ countdownArmed: false, hasChainRest: false })).toBe(
      'immediate'
    );
  });

  it('returns countdown when the host armed Start countdown', () => {
    expect(resolveMissionStartSource({ countdownArmed: true, hasChainRest: false })).toBe(
      'countdown'
    );
  });

  it('prefers chain when a chain rest banner is present', () => {
    expect(resolveMissionStartSource({ countdownArmed: true, hasChainRest: true })).toBe('chain');
  });
});

describe('rallyPointStayDurationSec', () => {
  it('floors elapsed seconds and never goes negative', () => {
    expect(rallyPointStayDurationSec(1_000, 4_500)).toBe(3);
    expect(rallyPointStayDurationSec(5_000, 4_000)).toBe(0);
  });
});

describe('isWaitingRoomPresenceState', () => {
  it('is true only for waiting and setup', () => {
    expect(isWaitingRoomPresenceState('waiting')).toBe(true);
    expect(isWaitingRoomPresenceState('setup')).toBe(true);
    expect(isWaitingRoomPresenceState('work')).toBe(false);
    expect(isWaitingRoomPresenceState('finished')).toBe(false);
    expect(isWaitingRoomPresenceState(null)).toBe(false);
  });
});
