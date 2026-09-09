import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ShareCardPanel } from '@/components/share/ShareCardPanel';
import type { ReplayData } from '@/lib/share/types';

const { renderCardBlob } = vi.hoisted(() => ({ renderCardBlob: vi.fn() }));
vi.mock('@/lib/share/renderCard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/share/renderCard')>()),
  renderCardBlob,
}));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn(), trackBeacon: vi.fn() }));
vi.mock('@/lib/share/replay/useReplay', () => ({
  useReplay: () => ({ blob: null, state: 'idle', progress: 0, start: () => undefined }),
}));

const data: ReplayData = {
  mission: {
    id: 'm1',
    templateId: null,
    // The real column shape: a bare array of movements carrying `target`.
    workout: [
      { name: 'Air Squats', target: 10, unit: 'reps' },
      { name: 'Hand-Release Push-ups', target: 10, unit: 'reps' },
    ],
    capSeconds: 300,
    durationMinutes: 5,
    intensityTier: null,
    state: 'finished',
    startedAt: '2026-09-09T10:00:00Z',
    segmentIndex: 0,
  },
  participants: [
    {
      participantId: 'p1',
      userId: null,
      displayName: 'Justin',
      isMe: true,
      finalRounds: 3,
      finalReps: 60,
      finalScore: 119,
      role: 'host',
    },
  ],
  rounds: [
    { participantId: 'p1', n: 1, atSeconds: 10 },
    { participantId: 'p1', n: 2, atSeconds: 22 },
    { participantId: 'p1', n: 3, atSeconds: 36 },
  ],
};

function addPhoto(): void {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['x'], 'athlete.png', { type: 'image/png' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
}

describe('adding a photo to the share card', () => {
  afterEach(() => {
    cleanup();
    renderCardBlob.mockReset();
  });

  it('re-renders the preview instead of serving the cached photo-less card', async () => {
    // Regression: blobs were cached by ratio and variant only, so the render
    // after a photo was added hit the cache and handed back the card drawn
    // without it. Adding a photo appeared to do nothing. Found by rendering a
    // real card, not by a test.
    // jsdom has no object URLs and no ImageBitmap decoder.
    let urls = 0;
    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: () => `blob:card-${(urls += 1)}`,
        revokeObjectURL: () => undefined,
      })
    );
    renderCardBlob.mockResolvedValue(new Blob(['card'], { type: 'image/png' }));
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 4, height: 5, close() {} })
    );

    render(<ShareCardPanel data={data} workoutTitle="The Piston" />);
    await waitFor(() => expect(renderCardBlob).toHaveBeenCalledTimes(1));
    expect(renderCardBlob.mock.calls[0][1].photo).toBeNull();

    addPhoto();

    await waitFor(() => expect(screen.getByText('Remove photo')).toBeTruthy());
    await waitFor(() => expect(renderCardBlob).toHaveBeenCalledTimes(2));
    expect(renderCardBlob.mock.calls[1][1].photo).toMatchObject({ width: 4, height: 5 });
  });
});
