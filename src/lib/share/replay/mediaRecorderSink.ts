import type { FrameSink } from '@/lib/share/replay/encodeLoop';
import { REPLAY_FPS } from '@/lib/share/replay/frames';
import { blobTypeFor, frameDelayMs, recorderMimeType } from '@/lib/share/replay/recorderMime';

export interface MediaRecorderSinkOptions {
  fps?: number;
  /** Must be a DOM canvas: captureStream does not exist on OffscreenCanvas, which is why this path cannot use the worker. */
  canvas: HTMLCanvasElement;
  prefer: 'mp4' | 'webm';
  bitrate?: number;
  /** Injected so the pacing can be tested without waiting twenty real seconds. */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

interface CaptureTrack extends MediaStreamTrack {
  requestFrame?: () => void;
}

/**
 * MediaRecorder, for browsers with no VideoEncoder.
 *
 * This is a recorder, not an encoder, and the difference is the whole shape of
 * the thing. WebCodecs takes frames as fast as they can be drawn and finishes
 * a twenty-second replay in under three seconds. MediaRecorder timestamps
 * frames by when they arrive, so the only way to get a twenty-second video is
 * to spend twenty seconds handing frames over on the clock they will be played
 * back on. The wait is inherent, not a bug to optimise away, and the UI says so
 * before the athlete starts rather than after.
 *
 * captureStream(0) means "capture nothing until I ask", so each frame is
 * pushed deliberately by requestFrame() rather than sampled whenever the
 * browser feels like it. A browser without requestFrame gets a timed capture
 * instead, which is less exact but still produces the right duration.
 */
export async function createMediaRecorderSink(
  options: MediaRecorderSinkOptions
): Promise<FrameSink> {
  const scope = globalThis as unknown as {
    MediaRecorder: typeof MediaRecorder & { isTypeSupported(type: string): boolean };
  };
  const mimeType = recorderMimeType(options.prefer, (type) =>
    scope.MediaRecorder.isTypeSupported(type)
  );
  if (!mimeType) {
    throw new Error(`no ${options.prefer} recording support`);
  }

  const stream = options.canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CaptureTrack | undefined;
  const manual = typeof track?.requestFrame === 'function';

  const chunks: BlobPart[] = [];
  const recorder = new scope.MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: options.bitrate ?? 6_000_000,
  });
  recorder.ondataavailable = (event: BlobEvent) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  let recorderError: Error | null = null;
  recorder.onerror = (event: Event) => {
    const cause = (event as unknown as { error?: DOMException }).error;
    recorderError = new Error(cause?.message ?? 'recording failed');
  };

  const stopTracks = () => stream.getTracks().forEach((entry) => entry.stop());

  const fps = options.fps ?? REPLAY_FPS;
  const now = options.now ?? (() => performance.now());
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  recorder.start();
  const startedAt = now();

  return {
    async addFrame(_index, timestampMicros) {
      if (recorderError) {
        throw recorderError;
      }
      const wait = frameDelayMs(timestampMicros, now() - startedAt);
      if (wait > 0) {
        await sleep(wait);
      }
      if (manual) {
        track?.requestFrame?.();
      }
    },
    async finish() {
      if (recorderError) {
        throw recorderError;
      }
      // The last frame needs a moment on screen before the recorder stops, or
      // it lands with no duration and the freeze is cut short. One frame's
      // worth, not an arbitrary drain: a longer wait is recorded too, and this
      // path's length is whatever the wall clock says it is.
      await sleep(1000 / fps);
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.stop();
      });
      stopTracks();
      if (recorderError) {
        throw recorderError;
      }
      return new Blob(chunks, { type: blobTypeFor(mimeType) });
    },
    close() {
      try {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      } catch {
        /* already stopped */
      }
      stopTracks();
    },
  };
}
