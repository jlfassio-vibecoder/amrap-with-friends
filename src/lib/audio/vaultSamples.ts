export const VAULT_SAMPLE_URLS = {
  roundLog: '/audio/vault/vault-round-log.mp3',
  missionStart: '/audio/vault/vault-session-start.mp3',
} as const;

export type VaultSampleId = keyof typeof VAULT_SAMPLE_URLS;

const buffers: Partial<Record<VaultSampleId, AudioBuffer>> = {};
let loadPromise: Promise<void> | null = null;

export function resetVaultSamplesForTests(): void {
  for (const key of Object.keys(buffers) as VaultSampleId[]) {
    delete buffers[key];
  }
  for (const key of Object.keys(activeSources) as VaultSampleId[]) {
    delete activeSources[key];
  }
  loadPromise = null;
}

async function decodeSample(context: AudioContext, url: string): Promise<AudioBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load vault sample: ${url} (${response.status})`);
  }
  const data = await response.arrayBuffer();
  return context.decodeAudioData(data.slice(0));
}

/** Decode both vault MP3s into the given AudioContext (idempotent). */
export function preloadVaultSamples(context: AudioContext): Promise<void> {
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    const entries = Object.entries(VAULT_SAMPLE_URLS) as [VaultSampleId, string][];
    await Promise.all(
      entries.map(async ([id, url]) => {
        if (buffers[id]) {
          return;
        }
        try {
          buffers[id] = await decodeSample(context, url);
        } catch {
          // Leave buffer unset; callers fall back to synthesis.
        }
      })
    );
  })();

  return loadPromise;
}

/** The source currently playing for each singleton cue, so it can be cut off. */
const activeSources: Partial<Record<VaultSampleId, AudioBufferSourceNode>> = {};

/**
 * Play a preloaded vault sample.
 *
 * `singleton` stops whatever that cue is already playing first. A round-log cue
 * on a 45-second round can still be sounding when the next round is logged, and
 * two overlapping copies of the same sample read as a stutter rather than as
 * two taps.
 *
 * @returns true if playback started, false if the sample is not ready.
 */
export function playVaultSample(
  context: AudioContext,
  id: VaultSampleId,
  options?: { peakGain?: number; singleton?: boolean }
): boolean {
  const buffer = buffers[id];
  if (!buffer) {
    void preloadVaultSamples(context);
    return false;
  }

  if (options?.singleton) {
    try {
      activeSources[id]?.stop();
    } catch {
      // A source that already ended throws on stop; nothing to cut off.
    }
    delete activeSources[id];
  }

  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  gain.gain.value = options?.peakGain ?? 0.9;
  source.connect(gain);
  gain.connect(context.destination);
  source.start(context.currentTime);

  if (options?.singleton) {
    activeSources[id] = source;
    source.onended = () => {
      if (activeSources[id] === source) {
        delete activeSources[id];
      }
    };
  }
  return true;
}

export function isVaultSampleReady(id: VaultSampleId): boolean {
  return buffers[id] !== undefined;
}
