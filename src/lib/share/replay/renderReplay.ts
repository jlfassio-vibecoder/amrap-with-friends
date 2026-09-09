import { CUTS, type CutId } from '@/lib/share/cuts';
import { drawFrame, type Ctx, type DrawFrameOptions } from '@/lib/share/renderer/drawFrame';
import { LAYOUTS } from '@/lib/share/renderer/theme';
import { frameAtVideoTime } from '@/lib/share/timeline';
import { runEncodeLoop } from '@/lib/share/replay/encodeLoop';
import { createWebCodecsSink } from '@/lib/share/replay/webCodecsSink';
import { REPLAY_FPS } from '@/lib/share/replay/frames';
import type { ReplayData } from '@/lib/share/types';

export interface RenderReplayOptions {
  data: ReplayData;
  cutId: CutId;
  draw: DrawFrameOptions;
  onProgress?: (frame: number, total: number) => void;
  isCancelled?: () => boolean;
}

/**
 * Render and encode a replay on whatever canvas this context has.
 *
 * Takes a canvas factory rather than creating one, so the Worker passes an
 * OffscreenCanvas and the main-thread fallback passes a DOM canvas without
 * this file knowing which it got — the renderer has been DOM-free since Phase
 * 1 precisely so this could be true.
 */
export async function renderReplay(
  options: RenderReplayOptions,
  createCanvas: (
    width: number,
    height: number
  ) => { canvas: OffscreenCanvas | HTMLCanvasElement; ctx: Ctx | null }
): Promise<Blob> {
  const spec = LAYOUTS[options.draw.layout];
  const { canvas, ctx } = createCanvas(spec.width, spec.height);
  if (!ctx) {
    throw new Error('no 2d context for replay');
  }

  const sink = await createWebCodecsSink({
    canvas,
    width: spec.width,
    height: spec.height,
    fps: REPLAY_FPS,
  });

  const drawOptions: DrawFrameOptions = {
    ...options.draw,
    capSeconds: options.data.mission.capSeconds,
  };

  return runEncodeLoop({
    cutId: options.cutId,
    sink,
    onProgress: options.onProgress,
    isCancelled: options.isCancelled,
    drawFrame: (_index, t) => {
      drawFrame(ctx, frameAtVideoTime(options.data, t, options.cutId), drawOptions);
    },
  });
}

export function replayFileName(shareId: string, cutId: CutId): string {
  return `amrap-replay-${cutId}-${shareId}.mp4`;
}

export function replayDurationSeconds(cutId: CutId): number {
  return CUTS[cutId].durationSeconds;
}
