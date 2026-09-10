import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useReplay } from '@/lib/share/replay/useReplay';
import type { DrawFrameOptions } from '@/lib/share/renderer/drawFrame';
import type { ReplayData } from '@/lib/share/types';

const { renderReplay } = vi.hoisted(() => ({ renderReplay: vi.fn() }));
vi.mock('@/lib/share/replay/renderReplay', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/share/replay/renderReplay')>()),
  renderReplay,
}));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn(), trackBeacon: vi.fn() }));
vi.mock('@/lib/share/replay/encoderPath', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/share/replay/encoderPath')>()),
  readCapabilities: () => ({
    hasVideoEncoder: true,
    hasMediaRecorder: false,
    hasCaptureStream: false,
  }),
}));

const data = {
  mission: { id: 'm', capSeconds: 300, durationMinutes: 5, segmentIndex: 0 },
  participants: [{ participantId: 'p1', displayName: 'Justin', isMe: true }],
  rounds: [],
} as unknown as ReplayData;

const draw = (layout: string): DrawFrameOptions =>
  ({ layout, variant: 'result', title: 'The Piston' }) as unknown as DrawFrameOptions;

describe('useReplay', () => {
  afterEach(() => {
    cleanup();
    renderReplay.mockReset();
  });

  it('does not keep offering a replay rendered for a different card shape', async () => {
    // The blob is cached per cut and layout, but status and blob are plain
    // state: switching shape left "ready" on screen holding the file made for
    // the previous one, so Share handed over a video that did not match the
    // card being previewed. Same class as the card-cache bug in #133.
    renderReplay.mockImplementation(() =>
      Promise.resolve(new Blob(['tall'], { type: 'video/mp4' }))
    );
    // No Worker/OffscreenCanvas in jsdom, so the inline path runs.
    const { result, rerender } = renderHook(({ options, key }) => useReplay(data, options, key), {
      initialProps: { options: draw('story'), key: 'story:result:0' },
    });

    await act(async () => {
      result.current.start('story9');
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.blob).toBeTruthy();

    rerender({ options: draw('landscape'), key: 'landscape:result:0' });
    expect(result.current.status).not.toBe('ready');
    expect(result.current.blob).toBeNull();
  });

  it('offers the earlier replay again when the card comes back', async () => {
    // The render is kept per shape, so flipping away and back must not cost
    // another thirty seconds of encoding.
    renderReplay.mockImplementation(() => Promise.resolve(new Blob(['a'], { type: 'video/mp4' })));
    const { result, rerender } = renderHook(({ options, key }) => useReplay(data, options, key), {
      initialProps: { options: draw('story'), key: 'story:result:0' },
    });

    await act(async () => {
      result.current.start('story9');
    });
    expect(result.current.status).toBe('ready');

    rerender({ options: draw('landscape'), key: 'landscape:result:0' });
    expect(result.current.status).toBe('idle');

    rerender({ options: draw('story'), key: 'story:result:0' });
    expect(result.current.status).toBe('ready');
    expect(renderReplay).toHaveBeenCalledTimes(1);
  });

  it('does not re-encode a cut it already holds', async () => {
    renderReplay.mockImplementation(() => Promise.resolve(new Blob(['a'], { type: 'video/mp4' })));
    const { result } = renderHook(() => useReplay(data, draw('story'), 'story:result:0'));

    await act(async () => {
      result.current.start('story9');
    });
    await act(async () => {
      result.current.start('story9');
    });
    expect(renderReplay).toHaveBeenCalledTimes(1);
  });

  it('reports a failure against the card it was rendering, not the next one', async () => {
    renderReplay.mockImplementation(() => Promise.reject(new Error('encoder gave up')));
    const { result, rerender } = renderHook(({ options, key }) => useReplay(data, options, key), {
      initialProps: { options: draw('story'), key: 'story:result:0' },
    });

    await act(async () => {
      result.current.start('story9');
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toContain('encoder gave up');

    // A different card has no failure of its own to report.
    rerender({ options: draw('landscape'), key: 'landscape:result:0' });
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });
});
