import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createNoiseBuffer,
  playEnd,
  playGo,
  playIgnition,
  playPrepBlip,
  playRoundLogged,
  resetTacticalAudioForTests,
  unlockTacticalAudio,
} from '@/lib/audio/tacticalSynthesis';

type ScheduledOsc = {
  type: OscillatorType;
  frequencyStart: number;
  frequencyEnd: number | null;
  startAt: number;
  stopAt: number;
};

type ScheduledNoise = {
  durationSec: number;
  startAt: number;
  filterType: BiquadFilterType | null;
  filterFrequency: number | null;
  filterFrequencyEnd: number | null;
};

let currentTime = 0;
let scheduledOsc: ScheduledOsc[] = [];
let scheduledNoise: ScheduledNoise[] = [];
let waveShapersCreated = 0;

function createParam(initial = 0) {
  return {
    value: initial,
    _start: initial as number | undefined,
    _end: undefined as number | undefined,
    setValueAtTime: vi.fn(function setValueAtTime(
      this: { value: number; _start?: number },
      v: number
    ) {
      this._start = v;
      this.value = v;
    }),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(function exponentialRampToValueAtTime(
      this: { value: number; _end?: number },
      v: number
    ) {
      this._end = v;
      this.value = v;
    }),
    cancelScheduledValues: vi.fn(),
  };
}

function createFakeAudioContext() {
  return {
    currentTime,
    sampleRate: 48000,
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    createBuffer(channels: number, length: number, sampleRate: number) {
      const data = new Float32Array(length);
      return {
        numberOfChannels: channels,
        length,
        sampleRate,
        getChannelData: () => data,
      };
    },
    createBufferSource() {
      const source: {
        buffer: AudioBuffer | null;
        connect: ReturnType<typeof vi.fn>;
        start: (at: number) => void;
        stop: () => void;
        _startAt: number;
        _filter: {
          type: BiquadFilterType;
          frequency: ReturnType<typeof createParam>;
        } | null;
      } = {
        buffer: null,
        connect: vi.fn((node: unknown) => {
          if (
            node &&
            typeof node === 'object' &&
            'type' in node &&
            'frequency' in node
          ) {
            source._filter = node as {
              type: BiquadFilterType;
              frequency: ReturnType<typeof createParam>;
            };
          }
          return node;
        }),
        start(at: number) {
          source._startAt = at;
        },
        stop() {
          const durationSec = source.buffer
            ? source.buffer.length / (source.buffer.sampleRate || 48000)
            : 0;
          scheduledNoise.push({
            durationSec,
            startAt: source._startAt,
            filterType: source._filter?.type ?? null,
            filterFrequency:
              source._filter?.frequency._start ??
              source._filter?.frequency.value ??
              null,
            filterFrequencyEnd: source._filter?.frequency._end ?? null,
          });
        },
        _startAt: 0,
        _filter: null,
      };
      return source;
    },
    createOscillator() {
      const freq = createParam(0);
      const osc = {
        type: 'sine' as OscillatorType,
        frequency: freq,
        connect: vi.fn(),
        start(at: number) {
          osc._startAt = at;
        },
        stop(at: number) {
          scheduledOsc.push({
            type: osc.type,
            frequencyStart: freq._start ?? freq.value,
            frequencyEnd: freq._end ?? null,
            startAt: osc._startAt,
            stopAt: at,
          });
        },
        _startAt: 0,
      };
      return osc;
    },
    createGain() {
      return {
        gain: createParam(1),
        connect: vi.fn(),
      };
    },
    createBiquadFilter() {
      return {
        type: 'lowpass' as BiquadFilterType,
        frequency: createParam(350),
        connect: vi.fn(),
      };
    },
    createWaveShaper() {
      waveShapersCreated += 1;
      return {
        curve: null as Float32Array | null,
        oversample: 'none' as OverSampleType,
        connect: vi.fn(),
      };
    },
  };
}

describe('tacticalSynthesis heavy profile', () => {
  beforeEach(() => {
    currentTime = 0;
    scheduledOsc = [];
    scheduledNoise = [];
    waveShapersCreated = 0;
    resetTacticalAudioForTests();
    vi.stubGlobal('AudioContext', function AudioContext() {
      return createFakeAudioContext();
    });
    unlockTacticalAudio();
  });

  afterEach(() => {
    resetTacticalAudioForTests();
    vi.unstubAllGlobals();
  });

  it('createNoiseBuffer fills frames with white-noise range values', () => {
    const context = unlockTacticalAudio();
    expect(context).not.toBeNull();
    const buffer = createNoiseBuffer(context!, 0.01);
    const data = buffer.getChannelData(0);
    expect(data.length).toBeGreaterThan(0);
    for (const sample of data) {
      expect(sample).toBeGreaterThanOrEqual(-1);
      expect(sample).toBeLessThanOrEqual(1);
    }
  });

  it('ignition layers a 150→30Hz sine drop with lowpassed noise', () => {
    playIgnition();
    expect(scheduledOsc).toHaveLength(1);
    expect(scheduledOsc[0]).toMatchObject({
      type: 'sine',
      frequencyStart: 150,
      frequencyEnd: 30,
    });
    expect(scheduledNoise).toHaveLength(1);
    expect(scheduledNoise[0]).toMatchObject({
      durationSec: expect.closeTo(0.2, 5),
      filterType: 'lowpass',
      filterFrequency: 400,
    });
  });

  it('prep layers a 1000Hz square with a 50ms noise strike', () => {
    playPrepBlip();
    expect(scheduledOsc[0]).toMatchObject({
      type: 'square',
      frequencyStart: 1000,
    });
    expect(scheduledNoise[0]?.durationSec).toBeCloseTo(0.05, 5);
  });

  it('GO layers a falling saw, sweeping noise, and a waveshaper', () => {
    playGo();
    expect(waveShapersCreated).toBeGreaterThanOrEqual(1);
    expect(scheduledOsc[0]).toMatchObject({
      type: 'sawtooth',
      frequencyStart: 200,
      frequencyEnd: 40,
    });
    expect(scheduledNoise[0]).toMatchObject({
      filterType: 'lowpass',
      filterFrequency: 2000,
      filterFrequencyEnd: 100,
    });
  });

  it('round logged fires two highpassed noise bursts 60ms apart with faint 800Hz squares', () => {
    playRoundLogged();
    expect(scheduledNoise).toHaveLength(2);
    expect(scheduledNoise[0]).toMatchObject({
      durationSec: expect.closeTo(0.03, 5),
      startAt: 0,
      filterType: 'highpass',
      filterFrequency: 2000,
    });
    expect(scheduledNoise[1]?.startAt).toBeCloseTo(0.06, 5);
    expect(scheduledOsc).toHaveLength(2);
    expect(scheduledOsc.every((o) => o.type === 'square' && o.frequencyStart === 800)).toBe(
      true
    );
  });

  it('END plays detuned 150Hz and 153Hz saws', () => {
    playEnd();
    const freqs = scheduledOsc.map((o) => o.frequencyStart).sort((a, b) => a - b);
    expect(freqs).toEqual([150, 153]);
    expect(scheduledOsc.every((o) => o.type === 'sawtooth')).toBe(true);
  });
});
