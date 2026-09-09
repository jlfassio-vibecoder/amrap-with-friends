import { describe, expect, it, vi } from 'vitest';
import { EncodeCancelled, runEncodeLoop, type FrameSink } from '@/lib/share/replay/encodeLoop';
import { frameSchedule } from '@/lib/share/replay/frames';

function fakeSink(): FrameSink & { frames: number[]; closed: boolean; finished: boolean } {
  const state = {
    frames: [] as number[],
    closed: false,
    finished: false,
    addFrame(_index: number, timestamp: number) {
      state.frames.push(timestamp);
    },
    async finish() {
      state.finished = true;
      return new Blob(['video'], { type: 'video/mp4' });
    },
    close() {
      state.closed = true;
    },
  };
  return state;
}

describe('runEncodeLoop', () => {
  it('encodes every frame in the schedule, including the last', () => {
    const sink = fakeSink();
    return runEncodeLoop({
      cutId: 'story9',
      sink,
      drawFrame: () => undefined,
    }).then(() => {
      expect(sink.frames).toHaveLength(frameSchedule('story9').totalFrames);
      expect(sink.finished).toBe(true);
    });
  });

  it('stamps frames at the frame rate, starting at zero', () => {
    const sink = fakeSink();
    return runEncodeLoop({ cutId: 'story9', sink, drawFrame: () => undefined }).then(() => {
      expect(sink.frames[0]).toBe(0);
      expect(sink.frames[1]).toBe(33333);
      expect(sink.frames[30]).toBe(1_000_000);
    });
  });

  it('draws each frame before it is captured', () => {
    const seen: number[] = [];
    const sink = fakeSink();
    sink.addFrame = (index) => {
      // The frame must already be drawn when the sink takes it, or the video
      // is one frame behind for its whole length.
      expect(seen[seen.length - 1]).toBe(index);
    };
    return runEncodeLoop({
      cutId: 'story9',
      sink,
      drawFrame: (index) => seen.push(index),
    });
  });

  it('reports progress as frames land', () => {
    const onProgress = vi.fn();
    return runEncodeLoop({
      cutId: 'story9',
      sink: fakeSink(),
      drawFrame: () => undefined,
      onProgress,
    }).then(() => {
      const total = frameSchedule('story9').totalFrames;
      expect(onProgress).toHaveBeenCalledWith(1, total);
      expect(onProgress).toHaveBeenLastCalledWith(total, total);
    });
  });

  it('closes the sink when cancelled, so no encoder session leaks', async () => {
    // An abandoned VideoEncoder holds a hardware session open; on a phone the
    // next attempt needs it back.
    const sink = fakeSink();
    let frames = 0;
    await expect(
      runEncodeLoop({
        cutId: 'full20',
        sink,
        drawFrame: () => {
          frames += 1;
        },
        isCancelled: () => frames > 5,
      })
    ).rejects.toBeInstanceOf(EncodeCancelled);
    expect(sink.closed).toBe(true);
    expect(sink.finished).toBe(false);
  });

  it('closes the sink when a frame throws', async () => {
    const sink = fakeSink();
    sink.addFrame = () => {
      throw new Error('encoder died');
    };
    await expect(
      runEncodeLoop({ cutId: 'story9', sink, drawFrame: () => undefined })
    ).rejects.toThrow('encoder died');
    expect(sink.closed).toBe(true);
  });
});
