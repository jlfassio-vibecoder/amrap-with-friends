import { describe, expect, it } from 'vitest';
import {
  MP4_RECORDER_TYPES,
  WEBM_RECORDER_TYPES,
  blobTypeFor,
  frameDelayMs,
  recorderMimeType,
} from '@/lib/share/replay/recorderMime';

describe('recorderMimeType', () => {
  it('takes the most compatible type the browser admits to', () => {
    const supported = (type: string) => type === 'video/mp4';
    // The specific-codec strings come first and are refused here, so the
    // bare one is what is left.
    expect(recorderMimeType('mp4', supported)).toBe('video/mp4');
  });

  it('prefers a codec-qualified string when one is supported', () => {
    expect(recorderMimeType('mp4', () => true)).toBe(MP4_RECORDER_TYPES[0]);
    expect(recorderMimeType('webm', () => true)).toBe(WEBM_RECORDER_TYPES[0]);
  });

  it('returns null rather than guessing when nothing is supported', () => {
    // A browser reporting MediaRecorder does not thereby support any codec in
    // it, and a bad mime is a constructor throw mid-render.
    expect(recorderMimeType('mp4', () => false)).toBeNull();
  });
});

describe('blobTypeFor', () => {
  it('keeps mp4 and webm apart, because only one uploads to Instagram', () => {
    expect(blobTypeFor('video/mp4;codecs=avc1.42E01E')).toBe('video/mp4');
    expect(blobTypeFor('video/webm;codecs=vp9')).toBe('video/webm');
  });
});

describe('frameDelayMs', () => {
  it('waits until the frame is due on the playback clock', () => {
    // 601 frames handed over at once become a video a few milliseconds long,
    // because MediaRecorder timestamps by arrival.
    expect(frameDelayMs(2_000_000, 0)).toBe(2000);
    expect(frameDelayMs(2_000_000, 500)).toBe(1500);
  });

  it('never waits when the render is already behind', () => {
    // Catching up beats stretching the video past its cut length.
    expect(frameDelayMs(1_000_000, 4000)).toBe(0);
  });
});
