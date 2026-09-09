import { frameSchedule, REPLAY_FPS } from '@/lib/share/replay/frames';
import type { CutId } from '@/lib/share/cuts';

/**
 * What a video encoder has to do, reduced to three methods.
 *
 * The frame loop is the part that goes wrong — a dropped final frame, a flush
 * before the last chunk, a cancel that leaks an encoder — and none of that is
 * specific to WebCodecs. Putting the loop behind this interface means it can
 * be tested with a fake in jsdom, where neither VideoEncoder nor
 * OffscreenCanvas exists.
 */
export interface FrameSink {
  addFrame(index: number, timestampMicros: number): Promise<void> | void;
  finish(): Promise<Blob>;
  close(): void;
}

export interface EncodeLoopOptions {
  cutId: CutId;
  fps?: number;
  sink: FrameSink;
  /** Draws frame `index` at video time `t`. Runs before the sink captures it. */
  drawFrame: (index: number, t: number) => void;
  onProgress?: (frame: number, total: number) => void;
  isCancelled?: () => boolean;
}

export class EncodeCancelled extends Error {
  constructor() {
    super('replay render cancelled');
    this.name = 'EncodeCancelled';
  }
}

/**
 * Draw every frame, hand each to the sink, then finish.
 *
 * Cancellation closes the sink rather than just stopping the loop: an
 * abandoned VideoEncoder holds a hardware encoder session open, and on a phone
 * that is a resource the next attempt needs back.
 */
export async function runEncodeLoop(options: EncodeLoopOptions): Promise<Blob> {
  const fps = options.fps ?? REPLAY_FPS;
  const schedule = frameSchedule(options.cutId, fps);
  const microsPerFrame = 1_000_000 / fps;

  try {
    for (let index = 0; index < schedule.totalFrames; index += 1) {
      if (options.isCancelled?.()) {
        throw new EncodeCancelled();
      }
      options.drawFrame(index, schedule.timeAt(index));
      await options.sink.addFrame(index, Math.round(index * microsPerFrame));
      options.onProgress?.(index + 1, schedule.totalFrames);
    }
    return await options.sink.finish();
  } catch (error) {
    options.sink.close();
    throw error;
  }
}
