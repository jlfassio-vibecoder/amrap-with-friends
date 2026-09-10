import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ShareCardPanel } from '@/components/share/ShareCardPanel';
import type { ReplayData } from '@/lib/share/types';

const { renderCardBlob } = vi.hoisted(() => ({ renderCardBlob: vi.fn() }));
vi.mock('@/lib/share/renderCard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/share/renderCard')>()),
  renderCardBlob,
}));
const { uploadShareImage } = vi.hoisted(() => ({ uploadShareImage: vi.fn() }));
vi.mock('@/lib/share/uploadShareImage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/share/uploadShareImage')>()),
  uploadShareImage,
}));
const { callRpc } = vi.hoisted(() => ({ callRpc: vi.fn() }));
vi.mock('@/lib/api/callRpc', () => ({ callRpc }));
const { shareArtifact } = vi.hoisted(() => ({
  shareArtifact: vi.fn().mockResolvedValue({ outcome: 'shared' }),
}));
vi.mock('@/lib/share/shareSheet', () => ({ shareArtifact }));
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

function stubBrowser(): void {
  // jsdom has no object URLs and no ImageBitmap decoder.
  let urls = 0;
  vi.stubGlobal(
    'URL',
    Object.assign(URL, {
      createObjectURL: () => `blob:card-${(urls += 1)}`,
      revokeObjectURL: () => undefined,
    })
  );
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn().mockImplementation(() =>
      Promise.resolve({
        width: 4,
        height: 5,
        closed: false,
        close() {
          this.closed = true;
        },
      })
    )
  );
}

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
      vi.fn().mockImplementation(() =>
        Promise.resolve({
          width: 4,
          height: 5,
          closed: false,
          close() {
            this.closed = true;
          },
        })
      )
    );

    render(<ShareCardPanel data={data} workoutTitle="The Piston" />);
    await waitFor(() => expect(renderCardBlob).toHaveBeenCalledTimes(1));
    expect(renderCardBlob.mock.calls[0][1].photo).toBeNull();

    addPhoto();

    await waitFor(() => expect(screen.getAllByText('photo added').length).toBe(2));
    await waitFor(() => expect(renderCardBlob).toHaveBeenCalledTimes(2));
    expect(renderCardBlob.mock.calls[1][1].photo).toMatchObject({ width: 4, height: 5 });
  });
});

describe('the image the link preview gets', () => {
  afterEach(() => {
    cleanup();
    renderCardBlob.mockReset();
    uploadShareImage.mockReset();
    callRpc.mockReset();
  });

  async function shareIt(): Promise<void> {
    stubBrowser();
    callRpc.mockResolvedValue({ data: null, error: null });
    uploadShareImage.mockResolvedValue({ ok: true });
    render(<ShareCardPanel data={data} workoutTitle="The Piston" />);
    await waitFor(() => expect(renderCardBlob).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Copy link'));
  }

  it('uploads png when it fits, which is the format every renderer decodes', async () => {
    // A card with no photo is flat colour and small, so it never needs webp.
    // Webp is the fallback, not the default: a card a renderer cannot decode
    // is worth less than a slightly larger one it can.
    renderCardBlob.mockResolvedValue(new Blob(['card'], { type: 'image/png' }));
    await shareIt();

    await waitFor(() => expect(uploadShareImage).toHaveBeenCalled());
    expect(uploadShareImage.mock.calls[0]![0].blob.type).toBe('image/png');
    const og = renderCardBlob.mock.calls.find((call) => call[2]?.type === 'image/png');
    expect(og![1].layout).toBe('story');
  });

  it('falls back to webp only when png will not fit the bucket', async () => {
    const big = new Blob([new Uint8Array(500 * 1024)], { type: 'image/png' });
    const small = new Blob(['small'], { type: 'image/webp' });
    renderCardBlob
      .mockResolvedValueOnce(new Blob(['preview'], { type: 'image/png' }))
      .mockResolvedValueOnce(big)
      .mockResolvedValue(small);
    await shareIt();

    await waitFor(() => expect(uploadShareImage).toHaveBeenCalled());
    expect(uploadShareImage.mock.calls[0]![0].blob.type).toBe('image/webp');
  });

  it('also uploads a wide card, because X crops a portrait one to its middle', async () => {
    // Measured on a posted card: X kept the reps line, the movements and half
    // the chart, and cropped away the hero score, the name, the link and the
    // watermark. twitter:image is a separate tag from og:image for this.
    renderCardBlob.mockResolvedValue(new Blob(['card'], { type: 'image/png' }));
    await shareIt();

    await waitFor(() => expect(uploadShareImage).toHaveBeenCalled());
    const layouts = renderCardBlob.mock.calls
      .filter((call) => call[2]?.type !== undefined)
      .map((call) => call[1].layout);
    expect(layouts).toContain('story');
    expect(layouts).toContain('landscape');
    expect(uploadShareImage.mock.calls[0]![0].wideBlob).toBeTruthy();
  });

  it('still uploads the portrait card when the wide one will not fit', async () => {
    // The wide card is a bonus. Losing it costs X the better crop; losing the
    // portrait one costs every other platform the card entirely.
    const tooBig = new Blob([new Uint8Array(500 * 1024)], { type: 'image/webp' });
    renderCardBlob.mockImplementation((_data, options: { layout: string }) =>
      Promise.resolve(
        options.layout === 'landscape' ? tooBig : new Blob(['card'], { type: 'image/png' })
      )
    );
    await shareIt();

    await waitFor(() => expect(uploadShareImage).toHaveBeenCalled());
    expect(uploadShareImage.mock.calls[0]![0].blob.type).toBe('image/png');
    expect(uploadShareImage.mock.calls[0]![0].wideBlob).toBeNull();
  });

  it('uploads the same portrait card the panel is previewing', async () => {
    // The link has to unfurl as the card the athlete composed. It shipped as a
    // landscape render for a while -- chosen to survive a crawler's 1.91:1
    // crop -- and that put a different card behind the link from the one on
    // screen, with the athlete's face cropped out of their own photo.
    renderCardBlob.mockResolvedValue(new Blob(['card'], { type: 'image/png' }));
    await shareIt();

    await waitFor(() => expect(uploadShareImage).toHaveBeenCalled());
    const ogCall = renderCardBlob.mock.calls.find((call) => call[2]?.type !== undefined);
    expect(ogCall).toBeDefined();
    expect(ogCall![1].layout).toBe('story');
  });

  it('sends the splits and the board with it, so nothing the panel shows is dropped', async () => {
    // The landscape render skipped the chart and had no room for the board.
    // Whatever the preview draws, the link gets.
    renderCardBlob.mockResolvedValue(new Blob(['card'], { type: 'image/webp' }));
    await shareIt();

    await waitFor(() => expect(uploadShareImage).toHaveBeenCalled());
    const preview = renderCardBlob.mock.calls[0]!;
    const og = renderCardBlob.mock.calls.find((call) => call[2]?.type !== undefined)!;
    expect(og[1].splits).toEqual(preview[1].splits);
    expect(og[1].showBoard).toBe(preview[1].showBoard);
    expect(og[1].variant).toBe(preview[1].variant);
  });

  it('uploads nothing when the share row never landed', async () => {
    // This is also what enforces the ordering. set_mission_share_image needs
    // the row to exist; both calls used to be fired un-awaited in the same
    // tick, and when the image lost that race the link kept the site logo with
    // nothing logged anywhere.
    renderCardBlob.mockResolvedValue(new Blob(['card'], { type: 'image/webp' }));
    stubBrowser();
    callRpc.mockResolvedValue({ data: null, error: new Error('offline') });
    render(<ShareCardPanel data={data} workoutTitle="The Piston" />);
    await waitFor(() => expect(renderCardBlob).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Copy link'));

    await waitFor(() => expect(callRpc).toHaveBeenCalledTimes(2)); // one retry
    expect(uploadShareImage).not.toHaveBeenCalled();
  });

  it('steps the quality down rather than giving up when the first encode is too big', async () => {
    // The photo card that could not be published was 1.3 MB as png against a
    // 400 KB bucket. Nothing surfaced -- the link just kept the site logo.
    const big = new Blob([new Uint8Array(500 * 1024)], { type: 'image/png' });
    const small = new Blob(['small'], { type: 'image/webp' });
    renderCardBlob
      .mockResolvedValueOnce(new Blob(['preview'], { type: 'image/png' }))
      .mockResolvedValueOnce(big)
      .mockResolvedValue(small);
    await shareIt();

    await waitFor(() => expect(uploadShareImage).toHaveBeenCalled());
    expect(uploadShareImage.mock.calls[0]![0].blob.size).toBe(small.size);
  });

  it('drops the photo from the preview render unless the athlete published it', async () => {
    // The athlete's result is not private; their face is. Before this the
    // whole upload was skipped, so the link fell back to the site logo.
    renderCardBlob.mockResolvedValue(new Blob(['card'], { type: 'image/webp' }));
    stubBrowser();
    callRpc.mockResolvedValue({ data: null, error: null });
    uploadShareImage.mockResolvedValue({ ok: true });
    render(<ShareCardPanel data={data} workoutTitle="The Piston" />);
    await waitFor(() => expect(renderCardBlob).toHaveBeenCalled());

    addPhoto();
    await waitFor(() => expect(screen.getAllByText('photo added').length).toBe(2));
    fireEvent.click(screen.getByText('Copy link'));

    await waitFor(() => expect(uploadShareImage).toHaveBeenCalled());
    const ogCall = renderCardBlob.mock.calls.find((call) => call[2]?.type !== undefined);
    expect(ogCall![1].photo).toBeNull();
  });

  it('puts the photo in the preview when the athlete did publish it', async () => {
    renderCardBlob.mockResolvedValue(new Blob(['card'], { type: 'image/webp' }));
    stubBrowser();
    callRpc.mockResolvedValue({ data: null, error: null });
    uploadShareImage.mockResolvedValue({ ok: true });
    render(<ShareCardPanel data={data} workoutTitle="The Piston" />);
    await waitFor(() => expect(renderCardBlob).toHaveBeenCalled());

    addPhoto();
    await waitFor(() => expect(screen.getAllByText('photo added').length).toBe(2));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('Copy link'));

    await waitFor(() => expect(uploadShareImage).toHaveBeenCalled());
    const ogCall = renderCardBlob.mock.calls.find((call) => call[2]?.type !== undefined);
    expect(ogCall![1].photo).toMatchObject({ width: 4, height: 5 });
  });
});

describe('the two ways to send a result', () => {
  afterEach(() => {
    cleanup();
    renderCardBlob.mockReset();
    uploadShareImage.mockReset();
    callRpc.mockReset();
    shareArtifact.mockClear();
  });

  async function panel(): Promise<void> {
    stubBrowser();
    callRpc.mockResolvedValue({ data: null, error: null });
    uploadShareImage.mockResolvedValue({ ok: true });
    renderCardBlob.mockResolvedValue(new Blob(['card'], { type: 'image/png' }));
    render(<ShareCardPanel data={data} workoutTitle="The Piston" />);
    await waitFor(() => expect(renderCardBlob).toHaveBeenCalled());
  }

  it('offers the card and the link as separate, differently named actions', async () => {
    // They do not produce the same thing, and both being called "share" hid
    // that. X has no card type that shows a tall image, so a link can never
    // unfurl there as the portrait card -- posting the picture is the only
    // way that card reaches X at all.
    await panel();
    expect(screen.getByText('Share the card')).toBeTruthy();
    expect(screen.getByText('Copy link')).toBeTruthy();
  });

  it('hands the actual image to the share sheet, not a URL', async () => {
    await panel();
    fireEvent.click(screen.getByText('Share the card'));
    await waitFor(() => expect(shareArtifact).toHaveBeenCalled());
    const handed = shareArtifact.mock.calls[0]![0];
    expect(handed.file).toBeInstanceOf(File);
    expect(handed.kind).toBe('card');
  });

  it('says what the difference is, because nobody should have to guess', async () => {
    await panel();
    expect(screen.getByText(/looks the same wherever it lands/)).toBeTruthy();
    expect(screen.getByText(/each app crops that its own way/)).toBeTruthy();
  });
});

describe('a photo per card shape', () => {
  afterEach(() => {
    cleanup();
    renderCardBlob.mockReset();
    uploadShareImage.mockReset();
    callRpc.mockReset();
  });

  async function panel(): Promise<void> {
    stubBrowser();
    callRpc.mockResolvedValue({ data: null, error: null });
    uploadShareImage.mockResolvedValue({ ok: true });
    renderCardBlob.mockResolvedValue(new Blob(['card'], { type: 'image/png' }));
    render(<ShareCardPanel data={data} workoutTitle="The Piston" />);
    await waitFor(() => expect(renderCardBlob).toHaveBeenCalled());
  }

  it('fills both slots by default, because most athletes have one photo', async () => {
    await panel();
    addPhoto();
    await waitFor(() => expect(screen.getAllByText('photo added')).toHaveLength(2));
  });

  it('fills only the wide slot when that is what the athlete picked', async () => {
    // The reason the split exists: a 3:4 phone photo centred into 1.78:1 keeps
    // a band out of the middle, so a head-and-shoulders shot arrives on X as a
    // torso. The athlete has to be able to give the wide card its own picture.
    await panel();
    fireEvent.click(screen.getByText('Wide card', { selector: 'button' }));
    addPhoto();
    await waitFor(() => expect(screen.getAllByText('photo added')).toHaveLength(1));
    expect(screen.getAllByText('no photo')).toHaveLength(1);
  });

  it('draws the wide slot when the wide ratio is previewed', async () => {
    // Flipping to 16:9 has to show what X will actually get, not a promise.
    await panel();
    fireEvent.click(screen.getByText('Wide card', { selector: 'button' }));
    addPhoto();
    await waitFor(() => expect(screen.getAllByText('photo added')).toHaveLength(1));

    renderCardBlob.mockClear();
    fireEvent.click(screen.getByText('16:9'));
    await waitFor(() => expect(renderCardBlob).toHaveBeenCalled());
    const wide = renderCardBlob.mock.calls.find((call) => call[1].layout === 'landscape');
    expect(wide![1].photo).toMatchObject({ width: 4, height: 5 });
  });

  it('leaves the tall card empty when only the wide slot was filled', async () => {
    await panel();
    fireEvent.click(screen.getByText('Wide card', { selector: 'button' }));
    addPhoto();
    await waitFor(() => expect(screen.getAllByText('photo added')).toHaveLength(1));

    renderCardBlob.mockClear();
    fireEvent.click(screen.getByText('1:1'));
    await waitFor(() => expect(renderCardBlob).toHaveBeenCalled());
    const square = renderCardBlob.mock.calls.find((call) => call[1].layout === 'square');
    expect(square![1].photo).toBeNull();
  });

  it('sends each uploaded card the photo chosen for it', async () => {
    await panel();
    addPhoto();
    await waitFor(() => expect(screen.getAllByText('photo added')).toHaveLength(2));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('Copy link'));

    await waitFor(() => expect(uploadShareImage).toHaveBeenCalled());
    const uploads = renderCardBlob.mock.calls.filter((call) => call[2]?.type !== undefined);
    for (const call of uploads) {
      expect(call[1].photo).toMatchObject({ width: 4, height: 5 });
    }
    expect(uploads.map((call) => call[1].layout)).toEqual(
      expect.arrayContaining(['story', 'landscape'])
    );
  });

  it('removing one slot leaves the other alone', async () => {
    // Both slots can hold the same bitmap. Closing it on one removal would
    // blank the other card.
    await panel();
    addPhoto();
    await waitFor(() => expect(screen.getAllByText('photo added')).toHaveLength(2));

    fireEvent.click(screen.getAllByText('Remove')[0]!);
    await waitFor(() => expect(screen.getAllByText('photo added')).toHaveLength(1));

    renderCardBlob.mockClear();
    fireEvent.click(screen.getByText('16:9'));
    await waitFor(() => expect(renderCardBlob).toHaveBeenCalled());
    const wide = renderCardBlob.mock.calls.find((call) => call[1].layout === 'landscape');
    expect(wide![1].photo).toMatchObject({ width: 4, height: 5, closed: false });
  });
});
