export const VAULT_SAMPLE_URLS = {
  roundLog: '/audio/vault/vault-round-log.mp3',
  sessionStart: '/audio/vault/vault-session-start.mp3',
} as const;

export type VaultSampleId = keyof typeof VAULT_SAMPLE_URLS;

const buffers: Partial<Record<VaultSampleId, AudioBuffer>> = {};
let loadPromise: Promise<void> | null = null;

export function resetVaultSamplesForTests(): void {
  for (const key of Object.keys(buffers) as VaultSampleId[]) {
    delete buffers[key];
  }
  loadPromise = null;
}

async function decodeSample(
  context: AudioContext,
  url: string
): Promise<AudioBuffer> {
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
    const entries = Object.entries(VAULT_SAMPLE_URLS) as [
      VaultSampleId,
      string,
    ][];
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

/**
 * Play a preloaded vault sample.
 * @returns true if playback started, false if the sample is not ready.
 */
export function playVaultSample(
  context: AudioContext,
  id: VaultSampleId,
  options?: { peakGain?: number }
): boolean {
  const buffer = buffers[id];
  if (!buffer) {
    void preloadVaultSamples(context);
    return false;
  }

  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  gain.gain.value = options?.peakGain ?? 0.9;
  source.connect(gain);
  gain.connect(context.destination);
  source.start(context.currentTime);
  return true;
}

export function isVaultSampleReady(id: VaultSampleId): boolean {
  return buffers[id] !== undefined;
}
