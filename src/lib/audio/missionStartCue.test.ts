import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { selectTacticalCue } from '@/lib/audio/selectTacticalCue';
import {
  playTacticalCue,
  resetTacticalAudioForTests,
  unlockTacticalAudio,
} from '@/lib/audio/tacticalSynthesis';
import { preloadVaultSamples, isVaultSampleReady } from '@/lib/audio/vaultSamples';

/**
 * End-to-end proof that pressing Start still reaches vault-session-start.mp3.
 *
 * Start → the timer enters `setup` → selectTacticalCue emits `ignition` →
 * playTacticalCue → playIgnition → the missionStart vault sample. Every link
 * asserted, so "the start sound is gone" becomes a failing test rather than an
 * argument.
 */

const started: string[] = [];

function fakeContext() {
  return {
    state: 'running',
    currentTime: 0,
    destination: {},
    resume: vi.fn(async () => undefined),
    decodeAudioData: vi.fn(async (data: ArrayBuffer) => ({
      length: data.byteLength,
      duration: 1,
      sampleRate: 48000,
      numberOfChannels: 1,
      getChannelData: () => new Float32Array(0),
    })),
    createBufferSource: () => {
      const source = {
        buffer: null as { length: number } | null,
        onended: null as (() => void) | null,
        connect: vi.fn(),
        stop: vi.fn(),
        start: vi.fn(() => {
          // 600-byte buffer is the mission-start sample in this fixture.
          started.push(source.buffer?.length === 600 ? 'missionStart' : 'roundLog');
        }),
      };
      return source;
    },
    createGain: () => ({
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        cancelScheduledValues: vi.fn(),
      },
      connect: vi.fn(),
    }),
    createOscillator: () => ({
      type: '',
      frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(() => started.push('synth')),
      stop: vi.fn(),
    }),
    createBuffer: () => ({ getChannelData: () => new Float32Array(64) }),
    createBiquadFilter: () => ({
      type: '',
      frequency: { value: 0, setValueAtTime: vi.fn() },
      Q: { value: 0 },
      connect: vi.fn(),
    }),
    createWaveShaper: () => ({ curve: null, oversample: '', connect: vi.fn() }),
  };
}

beforeEach(() => {
  started.length = 0;
  resetTacticalAudioForTests();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(url.includes('round-log') ? 100 : 600),
    }))
  );
  vi.stubGlobal(
    'AudioContext',
    vi.fn(function AudioContextStub(this: unknown) {
      return fakeContext();
    })
  );
});

afterEach(() => {
  resetTacticalAudioForTests();
  vi.unstubAllGlobals();
});

describe('pressing Start reaches the vault mission-start sample', () => {
  it('emits the ignition cue when the mission enters setup', () => {
    const cues = selectTacticalCue(
      { phase: 'waiting', timeLeftSec: 10, isPaused: false, workDurationSec: 1200 },
      { phase: 'setup', timeLeftSec: 10, isPaused: false, workDurationSec: 1200 }
    );
    expect(cues).toContain('ignition');
  });

  it('plays the missionStart sample once it is decoded', async () => {
    const context = unlockTacticalAudio();
    expect(context).not.toBeNull();
    await preloadVaultSamples(context as unknown as AudioContext);
    expect(isVaultSampleReady('missionStart')).toBe(true);

    playTacticalCue('ignition');
    expect(started).toContain('missionStart');
  });

  it('falls back to synthesis rather than silence before the sample decodes', () => {
    // This is what an athlete hears if Start is pressed before the download
    // finishes: a synthesised sweep, not nothing. Silence would mean the
    // context itself never opened.
    unlockTacticalAudio();
    playTacticalCue('ignition');
    expect(started.length).toBeGreaterThan(0);
    expect(started).not.toContain('missionStart');
  });

  it('is silent only when no gesture ever opened a context', () => {
    resetTacticalAudioForTests();
    playTacticalCue('ignition');
    expect(started).toHaveLength(0);
  });
});
