import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import type { FrameSink } from '@/lib/share/replay/encodeLoop';
import { REPLAY_FPS } from '@/lib/share/replay/frames';

/** Baseline first: the widest device support. Main profile is the fallback for encoders that refuse it. */
const CODECS = ['avc1.42E01E', 'avc1.4D401F'] as const;

export interface WebCodecsSinkOptions {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  width: number;
  height: number;
  fps?: number;
  bitrate?: number;
}

/**
 * WebCodecs + mp4-muxer.
 *
 * A keyframe every 60 frames (two seconds) keeps the file seekable without
 * inflating it — social players scrub, and a single keyframe at the start
 * makes that stutter.
 */
export async function createWebCodecsSink(options: WebCodecsSinkOptions): Promise<FrameSink> {
  const fps = options.fps ?? REPLAY_FPS;
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: options.width, height: options.height },
    // The moov atom has to be at the front or iOS Photos will not preview the
    // file, and some upload flows reject it outright.
    fastStart: 'in-memory',
  });

  const scope = globalThis as unknown as {
    VideoEncoder: typeof VideoEncoder;
    VideoFrame: typeof VideoFrame;
  };
  let encoderError: Error | null = null;

  const encoder = new scope.VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error: DOMException) => {
      encoderError = new Error(error.message);
    },
  });

  let configured = false;
  for (const codec of CODECS) {
    try {
      encoder.configure({
        codec,
        width: options.width,
        height: options.height,
        bitrate: options.bitrate ?? 6_000_000,
        framerate: fps,
        latencyMode: 'quality',
      });
      configured = true;
      break;
    } catch {
      /* try the next profile */
    }
  }
  if (!configured) {
    encoder.close();
    throw new Error('no supported H.264 profile');
  }

  return {
    async addFrame(index, timestampMicros) {
      if (encoderError) {
        throw encoderError;
      }
      const frame = new scope.VideoFrame(options.canvas as CanvasImageSource, {
        timestamp: timestampMicros,
        duration: Math.round(1_000_000 / fps),
      });
      encoder.encode(frame, { keyFrame: index % 60 === 0 });
      frame.close();
      // Back-pressure: without this the queue grows to 600 frames and a phone
      // runs out of memory before it runs out of work.
      if (encoder.encodeQueueSize > 8) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    },
    async finish() {
      await encoder.flush();
      encoder.close();
      muxer.finalize();
      return new Blob([target.buffer], { type: 'video/mp4' });
    },
    close() {
      try {
        encoder.close();
      } catch {
        /* already closed */
      }
    },
  };
}
