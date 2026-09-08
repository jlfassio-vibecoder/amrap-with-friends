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
        onended: null as (() => void) | null,
        connect: vi.fn(),
        start: vi.fn(() => {
          if (source.buffer) {
            started.push({ bufferLength: source.buffer.length });
          }
        }),
        stop: vi.fn(),
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

describe('a singleton cue cuts off its own previous playback', () => {
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

  it('stops the sounding source before starting the next', async () => {
    // The round-log cue is long enough to still be playing when a fast round
    // is logged; two overlapping copies read as a stutter, not two taps.
    const context = createFakeContext();
    const sources: Array<{ stop: ReturnType<typeof vi.fn> }> = [];
    const create = context.createBufferSource.bind(context);
    context.createBufferSource = () => {
      const source = create();
      sources.push(source);
      return source;
    };

    await preloadVaultSamples(context as unknown as AudioContext);
    playVaultSample(context as unknown as AudioContext, 'missionStart', { singleton: true });
    playVaultSample(context as unknown as AudioContext, 'missionStart', { singleton: true });

    expect(sources).toHaveLength(2);
    expect(sources[0].stop).toHaveBeenCalled();
    expect(sources[1].stop).not.toHaveBeenCalled();
  });

  it('leaves overlapping playback alone when not a singleton', async () => {
    const context = createFakeContext();
    const sources: Array<{ stop: ReturnType<typeof vi.fn> }> = [];
    const create = context.createBufferSource.bind(context);
    context.createBufferSource = () => {
      const source = create();
      sources.push(source);
      return source;
    };

    await preloadVaultSamples(context as unknown as AudioContext);
    playVaultSample(context as unknown as AudioContext, 'missionStart');
    playVaultSample(context as unknown as AudioContext, 'missionStart');

    expect(sources[0].stop).not.toHaveBeenCalled();
  });

  it('survives stopping a source that already ended', async () => {
    const context = createFakeContext();
    const create = context.createBufferSource.bind(context);
    context.createBufferSource = () => {
      const source = create();
      source.stop = vi.fn(() => {
        throw new Error('InvalidStateError');
      });
      return source;
    };

    await preloadVaultSamples(context as unknown as AudioContext);
    playVaultSample(context as unknown as AudioContext, 'missionStart', { singleton: true });
    expect(() =>
      playVaultSample(context as unknown as AudioContext, 'missionStart', { singleton: true })
    ).not.toThrow();
  });
});
