import { drawFrame, type DrawFrameOptions } from '@/lib/share/renderer/drawFrame';
import { LAYOUTS } from '@/lib/share/renderer/theme';
import { frameAt } from '@/lib/share/timeline';
import type { ReplayData } from '@/lib/share/types';

let fontsReady: Promise<void> | null = null;

/**
 * Text metrics are wrong until the font is actually loaded, and the first card
 * an athlete sees is the one that matters — so the first render waits, and
 * every later one reuses the same promise.
 */
async function ensureFonts(): Promise<void> {
  if (fontsReady) {
    return fontsReady;
  }
  fontsReady = (async () => {
    try {
      await document.fonts?.ready;
    } catch {
      /* a browser without the font API still draws, just with fallback metrics */
    }
  })();
  return fontsReady;
}

export interface EncodeOptions {
  /** Defaults to png, which is right for a flat card and wrong for one with a photo behind it. */
  type?: string;
  quality?: number;
}

export async function renderCardBlob(
  data: ReplayData,
  options: DrawFrameOptions,
  encode: EncodeOptions = {}
): Promise<Blob | null> {
  await ensureFonts();

  const spec = LAYOUTS[options.layout];
  const canvas = document.createElement('canvas');
  canvas.width = spec.width;
  canvas.height = spec.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  drawFrame(ctx, frameAt(data), options);

  const type = encode.type ?? 'image/png';
  return new Promise<Blob | null>((resolve) => {
    // A browser that cannot encode the requested type falls back to png
    // silently, so the caller checks blob.type rather than assuming.
    canvas.toBlob((blob) => resolve(blob), type, encode.quality);
  });
}

export function cardFileName(shareId: string, layout: string): string {
  return `amrap-${layout}-${shareId}.png`;
}
