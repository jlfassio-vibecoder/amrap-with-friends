import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  didPlayVaultDoorThisMission,
  playVaultDoor,
  primeVaultDoor,
  resetVaultDoorForTests,
  resetVaultDoorMissionFlag,
  VAULT_DOOR_URL,
} from '@/lib/audio/vaultDoor';

type FakeAudio = {
  src: string;
  preload: string;
  currentTime: number;
  load: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
};

let lastAudio: FakeAudio | null = null;

beforeEach(() => {
  resetVaultDoorForTests();
  lastAudio = null;
  vi.stubGlobal(
    'Audio',
    vi.fn(function FakeAudioCtor(this: FakeAudio, src?: string) {
      const el: FakeAudio = {
        src: src ?? '',
        preload: '',
        currentTime: 0,
        load: vi.fn(),
        play: vi.fn(() => Promise.resolve()),
        pause: vi.fn(),
      };
      lastAudio = el;
      return el;
    })
  );
});

afterEach(() => {
  resetVaultDoorForTests();
  vi.unstubAllGlobals();
});

describe('vaultDoor', () => {
  it('primes the session-start URL', () => {
    primeVaultDoor();
    expect(Audio).toHaveBeenCalledWith(VAULT_DOOR_URL);
    expect(lastAudio?.preload).toBe('auto');
    expect(lastAudio?.load).toHaveBeenCalled();
  });

  it('plays from the start and marks the mission flag', () => {
    expect(playVaultDoor()).toBe(true);
    expect(lastAudio?.pause).toHaveBeenCalled();
    expect(lastAudio?.currentTime).toBe(0);
    expect(lastAudio?.play).toHaveBeenCalled();
    expect(didPlayVaultDoorThisMission()).toBe(true);
  });

  it('is a singleton — a second play resets before starting again', () => {
    playVaultDoor();
    playVaultDoor();
    expect(lastAudio?.pause).toHaveBeenCalledTimes(2);
    expect(lastAudio?.play).toHaveBeenCalledTimes(2);
  });

  it('resetVaultDoorMissionFlag clears the host double-play guard', () => {
    playVaultDoor();
    expect(didPlayVaultDoorThisMission()).toBe(true);
    resetVaultDoorMissionFlag();
    expect(didPlayVaultDoorThisMission()).toBe(false);
  });
});
