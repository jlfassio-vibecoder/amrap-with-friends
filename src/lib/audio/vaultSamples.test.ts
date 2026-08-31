import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isVaultSampleReady,
  playVaultSample,
  preloadVaultSamples,
  resetVaultSamplesForTests,
  VAULT_SAMPLE_URLS,
} from '@/lib/audio/vaultSamples';

function createFakeContext() {
  const started: Array<{ bufferLength: number }> = [];
  return {
    currentTime: 0,
    destination: {},
    decodeAudioData: vi.fn(async (data: ArrayBuffer) => ({
      length: data.byteLength,
      duration: data.byteLength / 48000,
      sampleRate: 48000,
      numberOfChannels: 1,
      getChannelData: () => new Float32Array(0),
    })),
    createBufferSource() {
      const source = {
        buffer: null as { length: number } | null,
        connect: vi.fn(),
        start: vi.fn(() => {
          if (source.buffer) {
            started.push({ bufferLength: source.buffer.length });
          }
        }),
      };
      return source;
    },
    createGain() {
      return {
        gain: { value: 1 },
        connect: vi.fn(),
      };
    },
    _started: started,
  };
}

describe('vaultSamples', () => {
  beforeEach(() => {
    resetVaultSamplesForTests();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        status: 200,
        arrayBuffer: async () => new ArrayBuffer(url.includes('round-log') ? 100 : 600),
      }))
    );
  });

  afterEach(() => {
    resetVaultSamplesForTests();
    vi.unstubAllGlobals();
  });

  it('preloads both vault URLs into buffers', async () => {
    const context = createFakeContext();
    await preloadVaultSamples(context as unknown as AudioContext);

    expect(fetch).toHaveBeenCalledWith(VAULT_SAMPLE_URLS.roundLog);
    expect(fetch).toHaveBeenCalledWith(VAULT_SAMPLE_URLS.missionStart);
    expect(isVaultSampleReady('roundLog')).toBe(true);
    expect(isVaultSampleReady('missionStart')).toBe(true);
  });

  it('playVaultSample starts a buffer source when ready', async () => {
    const context = createFakeContext();
    await preloadVaultSamples(context as unknown as AudioContext);

    expect(playVaultSample(context as unknown as AudioContext, 'roundLog')).toBe(true);
    expect(context._started).toHaveLength(1);
  });

  it('playVaultSample returns false before preload finishes', () => {
    const context = createFakeContext();
    expect(playVaultSample(context as unknown as AudioContext, 'missionStart')).toBe(false);
  });
});
