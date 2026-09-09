/// <reference lib="webworker" />
import { renderReplay } from '@/lib/share/replay/renderReplay';
import type { CutId } from '@/lib/share/cuts';
import type { DrawFrameOptions } from '@/lib/share/renderer/drawFrame';
import type { ReplayData } from '@/lib/share/types';

export interface ReplayWorkerRequest {
  data: ReplayData;
  cutId: CutId;
  draw: DrawFrameOptions;
}

export type ReplayWorkerMessage =
  | { type: 'progress'; frame: number; total: number }
  | { type: 'done'; blob: Blob }
  | { type: 'error'; message: string };

/**
 * Encoding on the main thread janks the finish screen for the whole render, so
 * it happens here. Cancellation terminates the worker outright rather than
 * signalling it — a half-cancelled encoder is the thing that leaks a hardware
 * session, and terminate is the only way to be sure it is gone.
 */
self.onmessage = async (event: MessageEvent<ReplayWorkerRequest>) => {
  const post = (message: ReplayWorkerMessage) => self.postMessage(message);
  try {
    const blob = await renderReplay(
      {
        data: event.data.data,
        cutId: event.data.cutId,
        draw: event.data.draw,
        onProgress: (frame, total) => post({ type: 'progress', frame, total }),
      },
      (width, height) => {
        const canvas = new OffscreenCanvas(width, height);
        return { canvas, ctx: canvas.getContext('2d') };
      }
    );
    post({ type: 'done', blob });
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : 'render failed' });
  }
};
