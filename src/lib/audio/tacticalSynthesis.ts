export type TacticalCue =
  | 'ignition'
  | 'prep'
  | 'go'
  | 'minute'
  | 'finalMinute'
  | 'terminal'
  | 'end';

const MINUTE_GAIN = 0.14;
const FINAL_MINUTE_GAIN = 0.22;

let audioContext: AudioContext | null = null;

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const fromWindow = window.AudioContext;
  if (fromWindow) {
    return fromWindow;
  }
  const webkit = (
    window as unknown as { webkitAudioContext?: typeof AudioContext }
  ).webkitAudioContext;
  return webkit ?? null;
}

export function unlockTacticalAudio(): AudioContext | null {
  const Ctor = getAudioContextConstructor();
  if (!Ctor) {
    return null;
  }
  if (!audioContext) {
    audioContext = new Ctor();
  }
  void audioContext.resume();
  return audioContext;
}

export function resetTacticalAudioForTests(): void {
  audioContext = null;
}

/** Pure white noise buffer — foundation for impacts and mechanical scrapes. */
export function createNoiseBuffer(
  context: AudioContext,
  durationSec: number
): AudioBuffer {
  const sampleRate = context.sampleRate;
  const frameCount = Math.max(1, Math.floor(sampleRate * durationSec));
  const buffer = context.createBuffer(1, frameCount, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function scheduleGainDecay(
  gain: GainNode,
  peakGain: number,
  startAt: number,
  durationSec: number,
  exponential: boolean
): void {
  gain.gain.cancelScheduledValues(startAt);
  gain.gain.setValueAtTime(peakGain, startAt);
  const endAt = startAt + durationSec;
  if (exponential) {
    // exponentialRamp cannot reach exactly 0
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
  } else {
    gain.gain.linearRampToValueAtTime(0, endAt);
  }
}

function playPitchedOscillator(
  context: AudioContext,
  options: {
    type: OscillatorType;
    frequencyStart: number;
    frequencyEnd?: number;
    durationSec: number;
    peakGain: number;
    startOffsetSec?: number;
    exponentialDecay?: boolean;
    destination?: AudioNode;
  }
): void {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = options.type;

  const startAt = context.currentTime + (options.startOffsetSec ?? 0);
  const endAt = startAt + options.durationSec;
  const freqEnd = options.frequencyEnd ?? options.frequencyStart;

  osc.frequency.setValueAtTime(options.frequencyStart, startAt);
  if (freqEnd !== options.frequencyStart) {
    osc.frequency.exponentialRampToValueAtTime(freqEnd, endAt);
  }

  scheduleGainDecay(
    gain,
    options.peakGain,
    startAt,
    options.durationSec,
    options.exponentialDecay ?? true
  );

  osc.connect(gain);
  gain.connect(options.destination ?? context.destination);
  osc.start(startAt);
  osc.stop(endAt + 0.02);
}

function playNoiseBurst(
  context: AudioContext,
  options: {
    durationSec: number;
    peakGain: number;
    startOffsetSec?: number;
    filterType?: BiquadFilterType;
    filterFrequency?: number;
    filterFrequencyEnd?: number;
    exponentialDecay?: boolean;
    destination?: AudioNode;
  }
): void {
  const source = context.createBufferSource();
  source.buffer = createNoiseBuffer(context, options.durationSec);

  const gain = context.createGain();
  const startAt = context.currentTime + (options.startOffsetSec ?? 0);
  const endAt = startAt + options.durationSec;

  scheduleGainDecay(
    gain,
    options.peakGain,
    startAt,
    options.durationSec,
    options.exponentialDecay ?? true
  );

  let tail: AudioNode = source;
  if (options.filterType && options.filterFrequency !== undefined) {
    const filter = context.createBiquadFilter();
    filter.type = options.filterType;
    filter.frequency.setValueAtTime(options.filterFrequency, startAt);
    if (options.filterFrequencyEnd !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(
        options.filterFrequencyEnd,
        endAt
      );
    }
    source.connect(filter);
    filter.connect(gain);
    tail = gain;
  } else {
    source.connect(gain);
    tail = gain;
  }

  tail.connect(options.destination ?? context.destination);
  source.start(startAt);
  source.stop(endAt + 0.02);
}

function createDriveShaper(context: AudioContext, amount = 2.5): WaveShaperNode {
  const shaper = context.createWaveShaper();
  const samples = 256;
  const curve = new Float32Array(samples);
  const k = Math.max(0.001, amount);
  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
  }
  shaper.curve = curve;
  shaper.oversample = '2x';
  return shaper;
}

/** Vault door thud — sine drop + lowpassed noise scrape. */
export function playIgnition(): void {
  const context = audioContext;
  if (!context) {
    return;
  }
  playPitchedOscillator(context, {
    type: 'sine',
    frequencyStart: 150,
    frequencyEnd: 30,
    durationSec: 0.3,
    peakGain: 0.55,
  });
  playNoiseBurst(context, {
    durationSec: 0.2,
    peakGain: 0.35,
    filterType: 'lowpass',
    filterFrequency: 400,
  });
}

/** Metallic anvil strike — 1000Hz square + unfiltered noise tick. */
export function playPrepBlip(): void {
  const context = audioContext;
  if (!context) {
    return;
  }
  playPitchedOscillator(context, {
    type: 'square',
    frequencyStart: 1000,
    durationSec: 0.08,
    peakGain: 0.28,
    exponentialDecay: true,
  });
  playNoiseBurst(context, {
    durationSec: 0.05,
    peakGain: 0.4,
    exponentialDecay: true,
  });
}

/** Howitzer impact — falling saw + sweeping noise, lightly overdriven. */
export function playGo(): void {
  const context = audioContext;
  if (!context) {
    return;
  }
  const drive = createDriveShaper(context, 3);
  const bus = context.createGain();
  bus.gain.value = 0.7;
  drive.connect(bus);
  bus.connect(context.destination);

  playPitchedOscillator(context, {
    type: 'sawtooth',
    frequencyStart: 200,
    frequencyEnd: 40,
    durationSec: 0.6,
    peakGain: 0.45,
    destination: drive,
  });
  playNoiseBurst(context, {
    durationSec: 0.6,
    peakGain: 0.4,
    filterType: 'lowpass',
    filterFrequency: 2000,
    filterFrequencyEnd: 100,
    destination: drive,
  });
}

/** Bolt-action clack-clack — highpassed noise pairs + faint metallic square. */
export function playRoundLogged(): void {
  const context = audioContext;
  if (!context) {
    return;
  }
  for (const offset of [0, 0.06] as const) {
    playNoiseBurst(context, {
      durationSec: 0.03,
      peakGain: 0.45,
      startOffsetSec: offset,
      filterType: 'highpass',
      filterFrequency: 2000,
      exponentialDecay: true,
    });
    playPitchedOscillator(context, {
      type: 'square',
      frequencyStart: 800,
      durationSec: 0.03,
      peakGain: 0.08,
      startOffsetSec: offset,
      exponentialDecay: true,
    });
  }
}

export function playMinuteMark(): void {
  const context = audioContext;
  if (!context) {
    return;
  }
  playPitchedOscillator(context, {
    type: 'sine',
    frequencyStart: 800,
    durationSec: 0.2,
    peakGain: MINUTE_GAIN,
    exponentialDecay: false,
  });
}

export function playFinalMinute(): void {
  const context = audioContext;
  if (!context) {
    return;
  }
  playPitchedOscillator(context, {
    type: 'sine',
    frequencyStart: 800,
    durationSec: 0.08,
    peakGain: FINAL_MINUTE_GAIN,
    exponentialDecay: true,
  });
  playPitchedOscillator(context, {
    type: 'sine',
    frequencyStart: 800,
    durationSec: 0.08,
    peakGain: FINAL_MINUTE_GAIN,
    startOffsetSec: 0.12,
    exponentialDecay: true,
  });
}

export function playTerminalBlip(): void {
  const context = audioContext;
  if (!context) {
    return;
  }
  playPitchedOscillator(context, {
    type: 'square',
    frequencyStart: 1000,
    durationSec: 0.08,
    peakGain: 0.3,
    exponentialDecay: true,
  });
  playNoiseBurst(context, {
    durationSec: 0.04,
    peakGain: 0.25,
    exponentialDecay: true,
  });
}

/** Tank horn — detuned saw pair through a deep lowpass (beating klaxon). */
export function playEnd(): void {
  const context = audioContext;
  if (!context) {
    return;
  }
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1000;
  filter.connect(context.destination);

  for (const frequency of [150, 153] as const) {
    playPitchedOscillator(context, {
      type: 'sawtooth',
      frequencyStart: frequency,
      durationSec: 1.5,
      peakGain: 0.28,
      exponentialDecay: false,
      destination: filter,
    });
  }
}

export function playTacticalCue(cue: TacticalCue): void {
  switch (cue) {
    case 'ignition':
      playIgnition();
      return;
    case 'prep':
      playPrepBlip();
      return;
    case 'go':
      playGo();
      return;
    case 'minute':
      playMinuteMark();
      return;
    case 'finalMinute':
      playFinalMinute();
      return;
    case 'terminal':
      playTerminalBlip();
      return;
    case 'end':
      playEnd();
      return;
  }
}
