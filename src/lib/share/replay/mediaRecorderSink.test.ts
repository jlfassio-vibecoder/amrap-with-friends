import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMediaRecorderSink } from '@/lib/share/replay/mediaRecorderSink';

interface FakeRecorder {
  state: string;
  start: () => void;
  stop: () => void;
  ondataavailable?: (event: { data: Blob }) => void;
  onstop?: () => void;
  onerror?: (event: unknown) => void;
}

const built: { mimeType?: string; bitrate?: number }[] = [];
let recorder: FakeRecorder;
let requested = 0;
let tracksStopped = 0;
let track: { stop: () => void; requestFrame?: () => void };

/** jsdom has neither MediaRecorder nor captureStream; this is the smallest thing that behaves like both. */
function install(options: { supports?: (type: string) => boolean } = {}): void {
  class FakeMediaRecorder implements FakeRecorder {
    state = 'inactive';
    ondataavailable?: (event: { data: Blob }) => void;
    onstop?: () => void;
    onerror?: (event: unknown) => void;

    constructor(_stream: unknown, opts: MediaRecorderOptions) {
      built.push({ mimeType: opts.mimeType, bitrate: opts.videoBitsPerSecond });
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      recorder = this;
    }
    start(): void {
      this.state = 'recording';
    }
    stop(): void {
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob(['chunk']) });
      this.onstop?.();
    }
    static isTypeSupported: (type: string) => boolean;
  }
  FakeMediaRecorder.isTypeSupported = options.supports ?? (() => true);
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
}

/** `manual` mirrors a browser with requestFrame; without it capture is timed. */
function canvasWith(manual: boolean): HTMLCanvasElement {
  requested = 0;
  tracksStopped = 0;
  track = {
    stop: () => {
      tracksStopped += 1;
    },
    ...(manual ? { requestFrame: () => (requested += 1) } : {}),
  };
  return {
    captureStream: (fps: number) => {
      // 0 means "capture nothing until asked", which is what makes the pacing
      // deliberate rather than whatever the browser sampled.
      expect(fps).toBe(0);
      return { getVideoTracks: () => [track], getTracks: () => [track] };
    },
  } as unknown as HTMLCanvasElement;
}

describe('the MediaRecorder sink', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    built.length = 0;
  });

  it('paces frames on the playback clock instead of dumping them', async () => {
    // The whole difference from WebCodecs: MediaRecorder timestamps by
    // arrival, so 601 frames handed over at once is a video milliseconds long.
    install();
    let clock = 0;
    const slept: number[] = [];
    const sink = await createMediaRecorderSink({
      canvas: canvasWith(true),
      prefer: 'mp4',
      now: () => clock,
      sleep: async (ms) => {
        slept.push(ms);
        clock += ms;
      },
    });

    await sink.addFrame(0, 0);
    await sink.addFrame(1, 33_333);
    await sink.addFrame(2, 66_666);

    expect(slept).toEqual([33.333, 33.333]);
    expect(requested).toBe(3);
  });

  it('does not wait when the render has fallen behind', async () => {
    // Catching up beats stretching the video past its cut length.
    install();
    let clock = 0;
    const slept: number[] = [];
    const sink = await createMediaRecorderSink({
      canvas: canvasWith(true),
      prefer: 'mp4',
      now: () => (clock += 5000),
      sleep: async (ms) => {
        slept.push(ms);
      },
    });
    await sink.addFrame(10, 100_000);
    expect(slept).toEqual([]);
  });

  it('asks for mp4 on a browser that records it', async () => {
    install();
    await createMediaRecorderSink({ canvas: canvasWith(true), prefer: 'mp4', now: () => 0 });
    expect(built[0]!.mimeType).toContain('video/mp4');
  });

  it('asks for webm when that is all there is', async () => {
    install({ supports: (type) => type.startsWith('video/webm') });
    await createMediaRecorderSink({ canvas: canvasWith(true), prefer: 'webm', now: () => 0 });
    expect(built[0]!.mimeType).toContain('video/webm');
  });

  it('refuses up front rather than throwing mid-render', async () => {
    // A bad mime is a constructor throw, and by then the athlete has watched a
    // progress bar for twenty seconds.
    install({ supports: () => false });
    await expect(
      createMediaRecorderSink({ canvas: canvasWith(true), prefer: 'mp4', now: () => 0 })
    ).rejects.toThrow(/no mp4 recording/);
  });

  it('produces a blob typed as the container that was recorded', async () => {
    install({ supports: (type) => type.startsWith('video/webm') });
    const sink = await createMediaRecorderSink({
      canvas: canvasWith(true),
      prefer: 'webm',
      now: () => 0,
    });
    const blob = await sink.finish();
    expect(blob.type).toBe('video/webm');
  });

  it('stops the capture tracks, which hold the canvas otherwise', async () => {
    install();
    const sink = await createMediaRecorderSink({
      canvas: canvasWith(true),
      prefer: 'mp4',
      now: () => 0,
    });
    await sink.finish();
    expect(tracksStopped).toBeGreaterThan(0);
  });

  it('stops recording when cancelled', async () => {
    install();
    const sink = await createMediaRecorderSink({
      canvas: canvasWith(true),
      prefer: 'mp4',
      now: () => 0,
    });
    expect(recorder.state).toBe('recording');
    sink.close();
    expect(recorder.state).toBe('inactive');
    expect(tracksStopped).toBeGreaterThan(0);
  });

  it('still paces without requestFrame, where capture is timed instead', async () => {
    install();
    let clock = 0;
    const slept: number[] = [];
    const sink = await createMediaRecorderSink({
      canvas: canvasWith(false),
      prefer: 'mp4',
      now: () => clock,
      sleep: async (ms) => {
        slept.push(ms);
        clock += ms;
      },
    });
    await sink.addFrame(0, 0);
    await sink.addFrame(1, 33_333);
    expect(slept).toEqual([33.333]);
    expect(requested).toBe(0);
  });

  it('gives the final frame a moment before stopping', async () => {
    // Stop immediately after the last requestFrame and that frame lands with
    // no duration, cutting the freeze short.
    install();
    const slept: number[] = [];
    const sink = await createMediaRecorderSink({
      canvas: canvasWith(true),
      prefer: 'mp4',
      fps: 30,
      now: () => 0,
      sleep: async (ms) => {
        slept.push(ms);
      },
    });
    await sink.finish();
    expect(slept.at(-1)).toBeCloseTo(1000 / 30, 5);
  });
});
