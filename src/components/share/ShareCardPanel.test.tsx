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
const { shareArtifact, saveArtifacts } = vi.hoisted(() => ({
  shareArtifact: vi.fn().mockResolvedValue({ outcome: 'shared' }),
  saveArtifacts: vi.fn().mockResolvedValue({ outcome: 'downloaded' }),
}));
vi.mock('@/lib/share/shareSheet', () => ({ shareArtifact, saveArtifacts }));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn(), trackBeacon: vi.fn() }));
const { useReplay } = vi.hoisted(() => ({
  useReplay: vi.fn<
    () => {
      blob: Blob | null;
      status: string;
      progress: number;
      error: string | null;
      start: (cut?: string) => void;
      cancel: () => void;
    }
  >(() => ({
    blob: null,
    status: 'idle',
    progress: 0,
    error: null,
    start: vi.fn(),
    cancel: vi.fn(),
  })),
}));
vi.mock('@/lib/share/replay/useReplay', () => ({ useReplay }));
// jsdom has no VideoEncoder, and the replay section is hidden without one.
vi.mock('@/lib/share/replay/encoderPath', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/share/replay/encoderPath')>()),
  readCapabilities: () => ({
    hasVideoEncoder: true,
    hasMediaRecorder: false,
    hasCaptureStream: false,
  }),
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

const writeText = vi.fn().mockResolvedValue(undefined);

function stubBrowser(): void {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
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
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Wide 16:9' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Square 1:1' }));
    await waitFor(() => expect(renderCardBlob).toHaveBeenCalled());
    const square = renderCardBlob.mock.calls.find((call) => call[1].layout === 'square');
    expect(square![1].photo).toBeNull();
  });

  it('sends each uploaded card the photo chosen for it', async () => {
    await panel();
    addPhoto();
    await waitFor(() => expect(screen.getAllByText('photo added')).toHaveLength(2));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Wide 16:9' }));
    await waitFor(() => expect(renderCardBlob).toHaveBeenCalled());
    const wide = renderCardBlob.mock.calls.find((call) => call[1].layout === 'landscape');
    expect(wide![1].photo).toMatchObject({ width: 4, height: 5, closed: false });
  });
});

describe('keeping and texting a result', () => {
  afterEach(() => {
    cleanup();
    renderCardBlob.mockReset();
    uploadShareImage.mockReset();
    callRpc.mockReset();
    saveArtifacts.mockClear();
    writeText.mockClear();
  });

  async function panel(): Promise<void> {
    stubBrowser();
    callRpc.mockResolvedValue({ data: null, error: null });
    uploadShareImage.mockResolvedValue({ ok: true });
    renderCardBlob.mockResolvedValue(new Blob(['card'], { type: 'image/png' }));
    render(<ShareCardPanel data={data} workoutTitle="The Piston" />);
    await waitFor(() => expect(renderCardBlob).toHaveBeenCalled());
  }

  it('saves both cards, not whichever ratio happened to be on screen', async () => {
    // The tall one is for a feed and the wide one is for X. An athlete who
    // wanted one of them wanted the other too.
    await panel();
    fireEvent.click(screen.getByText('Save images', { selector: 'button' }));
    await waitFor(() => expect(saveArtifacts).toHaveBeenCalled());
    const names = saveArtifacts.mock.calls[0]![0].files.map((file: File) => file.name);
    expect(names).toHaveLength(2);
    expect(names.some((name: string) => name.includes('tall'))).toBe(true);
    expect(names.some((name: string) => name.includes('wide'))).toBe(true);
  });

  it('names the files in words an athlete reads, not the internal layouts', async () => {
    await panel();
    fireEvent.click(screen.getByText('Save images', { selector: 'button' }));
    await waitFor(() => expect(saveArtifacts).toHaveBeenCalled());
    const names: string[] = saveArtifacts.mock.calls[0]![0].files.map((file: File) => file.name);
    expect(names.join(' ')).not.toContain('story');
    expect(names.join(' ')).not.toContain('landscape');
  });

  it('copies the bare url for texting, with no caption in front of it', async () => {
    // A texting app shows the card when the message is the link and nothing
    // else; a caption in front of it drops most of them to plain blue text.
    await panel();
    fireEvent.click(screen.getByText('Copy link for texting', { selector: 'button' }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const copied: string = writeText.mock.calls.at(-1)![0];
    expect(copied).toMatch(/^\S+$/);
    expect(copied).toContain('/s/');
    expect(copied).not.toContain('AMRAP');
  });

  it('still offers the caption alongside the link on the other button', async () => {
    await panel();
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const copied: string = writeText.mock.calls.at(-1)![0];
    expect(copied).toContain('AMRAP');
    expect(copied).toContain('/s/');
  });
});

describe('the card shape control', () => {
  afterEach(() => {
    cleanup();
    renderCardBlob.mockReset();
    callRpc.mockReset();
  });

  async function panel(): Promise<void> {
    stubBrowser();
    callRpc.mockResolvedValue({ data: null, error: null });
    renderCardBlob.mockResolvedValue(new Blob(['card'], { type: 'image/png' }));
    render(<ShareCardPanel data={data} workoutTitle="The Piston" />);
    await waitFor(() => expect(renderCardBlob).toHaveBeenCalled());
  }

  it('says what the three chips are for', async () => {
    // Unlabelled, they read as four unrelated chips next to the squad toggle
    // and nothing said the numbers were choosing the card.
    await panel();
    expect(screen.getByRole('group', { name: 'Card shape' })).toBeTruthy();
  });

  it('names the shapes the same way the photo picker does', async () => {
    // The photo picker calls them the tall card and the wide card. A control
    // naming the same two things 9:16 and 16:9 left the athlete to work out
    // that those were the same two things.
    await panel();
    const shapes = screen.getByRole('group', { name: 'Card shape' });
    expect(shapes.textContent).toContain('Tall');
    expect(shapes.textContent).toContain('Wide');
    addPhoto();
    await waitFor(() => expect(screen.getAllByText('photo added')).toHaveLength(2));
    expect(screen.getAllByText('Tall card').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Wide card').length).toBeGreaterThan(0);
  });

  it('keeps the ratios, because that is what the destination asks for', async () => {
    await panel();
    const shapes = screen.getByRole('group', { name: 'Card shape' });
    expect(shapes.textContent).toContain('9:16');
    expect(shapes.textContent).toContain('16:9');
  });

  it('leaves the squad toggle outside the shape group', async () => {
    // It is independent, not one of three, and a label over the pair would
    // have claimed otherwise.
    const squad = {
      ...data,
      participants: [
        ...data.participants,
        {
          participantId: 'p2',
          userId: null,
          displayName: 'Britt',
          isMe: false,
          finalRounds: 2,
          finalReps: 0,
          finalScore: 90,
          role: 'guest',
        },
      ],
    } as unknown as typeof data;
    stubBrowser();
    callRpc.mockResolvedValue({ data: null, error: null });
    renderCardBlob.mockResolvedValue(new Blob(['card'], { type: 'image/png' }));
    render(<ShareCardPanel data={squad} workoutTitle="The Piston" />);
    await waitFor(() => expect(renderCardBlob).toHaveBeenCalled());

    expect(screen.getByText('Squad board')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Card shape' }).textContent).not.toContain(
      'Squad board'
    );
  });
});

describe('the replay panel', () => {
  afterEach(() => {
    cleanup();
    renderCardBlob.mockReset();
    callRpc.mockReset();
    writeText.mockClear();
    useReplay.mockReturnValue({
      blob: null,
      status: 'idle',
      progress: 0,
      error: null,
      start: vi.fn(),
      cancel: vi.fn(),
    });
  });

  async function panel(): Promise<void> {
    stubBrowser();
    callRpc.mockResolvedValue({ data: null, error: null });
    renderCardBlob.mockResolvedValue(new Blob(['card'], { type: 'image/png' }));
    render(<ShareCardPanel data={data} workoutTitle="The Piston" />);
    await waitFor(() => expect(renderCardBlob).toHaveBeenCalled());
  }

  it('clears a notice from an earlier action instead of leaving it under the replay', async () => {
    // Straight from a screenshot: "Caption and link copied." sat under the
    // Share replay button as though the replay had produced it. One notice
    // slot, shared by every action, and nothing ever cleared it.
    const share = vi.fn();
    useReplay.mockReturnValue({
      blob: new Blob(['mp4'], { type: 'video/mp4' }),
      status: 'ready',
      progress: 1,
      error: null,
      start: share,
      cancel: vi.fn(),
    });
    await panel();

    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => expect(screen.getByText('Caption and link copied.')).toBeTruthy());

    fireEvent.click(screen.getByText('Share replay'));
    await waitFor(() => expect(screen.queryByText('Caption and link copied.')).toBeNull());
  });

  it('shows the replay so it can be watched before it is posted', async () => {
    // The card has a preview; the replay had none, so the only way to see
    // what was about to go out was to post it.
    useReplay.mockReturnValue({
      blob: new Blob(['mp4'], { type: 'video/mp4' }),
      status: 'ready',
      progress: 1,
      error: null,
      start: vi.fn(),
      cancel: vi.fn(),
    });
    await panel();
    const video = document.querySelector('video');
    expect(video).toBeTruthy();
    expect(video!.getAttribute('src')).toMatch(/^blob:/);
  });

  it('lets the athlete choose the length before spending the render on it', async () => {
    await panel();
    const lengths = screen.getByRole('group', { name: 'Replay length' });
    expect(lengths.textContent).toContain('9s');
    expect(lengths.textContent).toContain('20s');
  });

  it('renders the length the athlete picked, not only the default', async () => {
    const start = vi.fn();
    useReplay.mockReturnValue({
      blob: null,
      status: 'idle',
      progress: 0,
      error: null,
      start,
      cancel: vi.fn(),
    });
    await panel();
    fireEvent.click(screen.getByRole('button', { name: '20s' }));
    fireEvent.click(screen.getByText('Make replay'));
    expect(start).toHaveBeenCalledWith('full20');
  });

  it('offers a re-render once one is ready, since the card underneath can change', async () => {
    useReplay.mockReturnValue({
      blob: new Blob(['mp4'], { type: 'video/mp4' }),
      status: 'ready',
      progress: 1,
      error: null,
      start: vi.fn(),
      cancel: vi.fn(),
    });
    await panel();
    expect(screen.getByText('Make it again')).toBeTruthy();
  });
});
