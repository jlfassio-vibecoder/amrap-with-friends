import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  identityStorageKey,
  readIdentityItem,
  removeIdentityItem,
  writeIdentityItem,
} from './identityStorage';

const PREFIX = 'amrap_participant_id';
const MISSION_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_MISSION_ID = '22222222-2222-4222-8222-222222222222';

/** A second tab starts with an empty sessionStorage but the same localStorage. */
function openNewTab(): void {
  sessionStorage.clear();
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
  sessionStorage.clear();
});

describe('identity storage', () => {
  it('keeps an identity readable from a second tab', () => {
    writeIdentityItem(PREFIX, MISSION_ID, 'participant-1');

    openNewTab();

    expect(readIdentityItem(PREFIX, MISSION_ID)).toBe('participant-1');
  });

  it('migrates a legacy per-tab value written before the durable store', () => {
    sessionStorage.setItem(identityStorageKey(PREFIX, MISSION_ID), 'legacy-participant');

    expect(readIdentityItem(PREFIX, MISSION_ID)).toBe('legacy-participant');

    openNewTab();

    expect(readIdentityItem(PREFIX, MISSION_ID)).toBe('legacy-participant');
  });

  it('does not resurrect a legacy value after the identity is removed', () => {
    sessionStorage.setItem(identityStorageKey(PREFIX, MISSION_ID), 'legacy-participant');
    readIdentityItem(PREFIX, MISSION_ID);

    removeIdentityItem(PREFIX, MISSION_ID);

    expect(readIdentityItem(PREFIX, MISSION_ID)).toBeNull();
  });

  it('keeps identities for different missions apart', () => {
    writeIdentityItem(PREFIX, MISSION_ID, 'participant-1');
    writeIdentityItem(PREFIX, OTHER_MISSION_ID, 'participant-2');

    expect(readIdentityItem(PREFIX, MISSION_ID)).toBe('participant-1');
    expect(readIdentityItem(PREFIX, OTHER_MISSION_ID)).toBe('participant-2');
  });

  it('prunes identities untouched for longer than the retention window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    writeIdentityItem(PREFIX, MISSION_ID, 'participant-1');
    writeIdentityItem('amrap_claim_token', MISSION_ID, 'claim-1');

    vi.setSystemTime(new Date('2026-03-01T00:00:00Z'));
    writeIdentityItem(PREFIX, OTHER_MISSION_ID, 'participant-2');

    expect(readIdentityItem(PREFIX, MISSION_ID)).toBeNull();
    expect(readIdentityItem('amrap_claim_token', MISSION_ID)).toBeNull();
    expect(readIdentityItem(PREFIX, OTHER_MISSION_ID)).toBe('participant-2');
  });

  it('keeps an identity alive while it is still being written to', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    writeIdentityItem(PREFIX, MISSION_ID, 'participant-1');

    vi.setSystemTime(new Date('2026-03-01T00:00:00Z'));
    writeIdentityItem(PREFIX, MISSION_ID, 'participant-1');
    writeIdentityItem(PREFIX, OTHER_MISSION_ID, 'participant-2');

    expect(readIdentityItem(PREFIX, MISSION_ID)).toBe('participant-1');
  });
});
