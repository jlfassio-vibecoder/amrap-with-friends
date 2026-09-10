import { describe, expect, it, vi } from 'vitest';
import { drawFrame, type Ctx } from '@/lib/share/renderer/drawFrame';
import { frameAt } from '@/lib/share/timeline';
import type { ReplayData } from '@/lib/share/types';

/**
 * jsdom has no canvas, so this records the calls instead. That is the right
 * level anyway: the value here is that the renderer draws the correct *text*,
 * stays inside the safe area, and never reaches for the DOM.
 */
interface DrawnText {
  text: string;
  x: number;
  y: number;
  /** The font in force when it was drawn, so type sizing is assertable. */
  font: string;
}

function recordingCtx(): {
  ctx: Ctx;
  texts: DrawnText[];
  rects: number[][];
  images: { x: number; y: number; width: number; height: number }[];
} {
  const texts: DrawnText[] = [];
  const rects: number[][] = [];
  const images: { x: number; y: number; width: number; height: number }[] = [];
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: (...args: number[]) => rects.push(args),
    drawImage: (_src: unknown, x: number, y: number, width: number, height: number) =>
      images.push({ x, y, width, height }),
    createLinearGradient: () => ({ addColorStop: () => undefined }),
    fillText: (text: string, x: number, y: number) =>
      texts.push({ text, x, y, font: (ctx as { font: string }).font }),
    // Width scales with the font size, as a real canvas does. A fixed-width
    // fake cannot detect overflow at all, which is how a 160px hero that did
    // not fit passed its own tests.
    measureText: (text: string) => {
      const size = Number(/(\d+)px/.exec((ctx as { font: string }).font ?? '')?.[1] ?? 40);
      return { width: text.length * size * 0.55 };
    },
    fillStyle: '',
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
  } as unknown as Ctx;
  return { ctx, texts, rects, images };
}

function data(participants: number, meRounds = 7): ReplayData {
  return {
    mission: {
      id: 'm1',
      templateId: 'blood-shunt',
      workout: null,
      capSeconds: 720,
      durationMinutes: 12,
      intensityTier: 3,
      state: 'finished',
      startedAt: null,
      segmentIndex: 0,
    },
    participants: Array.from({ length: participants }, (_, index) => ({
      participantId: `p${index}`,
      userId: null,
      displayName: index === 0 ? 'Me' : `Athlete ${index}`,
      isMe: index === 0,
      finalRounds: index === 0 ? meRounds : 3,
      finalReps: index === 0 ? 12 : 0,
      finalScore: null,
      role: index === 0 ? 'host' : 'joiner',
    })),
    rounds: [],
  };
}

const baseOptions = {
  layout: 'story' as const,
  variant: 'result' as const,
  title: 'The Hull Breach',
  subtitle: '12 min AMRAP · 9 Sep',
  shareUrl: 'amrapwithfriends.com/s/abc12345',
  watermark: true,
};

describe('drawFrame', () => {
  it('draws the score, the name and the link', () => {
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(data(3)), baseOptions);
    const all = texts.map((entry) => entry.text);
    expect(all).toContain('7 rounds + 12');
    expect(all).toContain('Me');
    expect(all).toContain('amrapwithfriends.com/s/abc12345');
    expect(all).toContain('The Hull Breach');
  });

  it('keeps everything inside the story safe area', () => {
    // Instagram covers the top 250px and bottom 300px of a Story with its own
    // UI; anything drawn there is invisible to the viewer.
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(data(6)), baseOptions);
    for (const entry of texts) {
      expect(entry.y).toBeGreaterThanOrEqual(250);
      expect(entry.y).toBeLessThanOrEqual(1920 - 300 + 80);
    }
  });

  it('omits the leaderboard for an amqap card', () => {
    // A quality flow has no score to rank; a board would misrepresent it.
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(data(4)), { ...baseOptions, variant: 'amqap' });
    expect(texts.map((entry) => entry.text)).not.toContain('Athlete 1');
  });

  it('drops the hero score on the squad card but keeps the board', () => {
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(data(4)), { ...baseOptions, variant: 'squad' });
    const all = texts.map((entry) => entry.text);
    expect(all).toContain('Athlete 1');
    expect(all.filter((text) => text === '7 rounds + 12')).toHaveLength(1); // board row only
  });

  it('omits the watermark when told to', () => {
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(data(2)), { ...baseOptions, watermark: false });
    expect(texts.map((entry) => entry.text)).not.toContain('AMRAP With Friends');
  });

  it('truncates a name rather than letting it run off the card', () => {
    const wide = data(2);
    wide.participants[0]!.displayName = 'A'.repeat(200);
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(wide), baseOptions);
    expect(texts.some((entry) => entry.text.endsWith('…'))).toBe(true);
  });
});

describe('drawFrame during the replay', () => {
  it('draws a countdown clock in the race phase, not a score hero', () => {
    const { ctx, texts } = recordingCtx();
    const race = { ...frameAt(data(3)), phase: 'race' as const, clockSeconds: 120, cardBlend: 0 };
    drawFrame(ctx, race, { ...baseOptions, capSeconds: 720 });
    expect(texts.map((entry) => entry.text)).toContain('10:00');
  });

  it('keeps the clock inside the story safe area', () => {
    // Instagram's own header sits over the top 250px.
    const { ctx, texts } = recordingCtx();
    const race = { ...frameAt(data(3)), phase: 'race' as const, clockSeconds: 0, cardBlend: 0 };
    drawFrame(ctx, race, { ...baseOptions, capSeconds: 720 });
    for (const entry of texts) {
      expect(entry.y).toBeGreaterThanOrEqual(250);
    }
  });

  it('draws a bar per athlete, sized by progress', () => {
    const { ctx, rects } = recordingCtx();
    const race = {
      ...frameAt(data(3)),
      phase: 'race' as const,
      clockSeconds: 300,
      cardBlend: 0,
    };
    race.bars = race.bars.map((bar, index) => ({ ...bar, progress: index === 0 ? 1 : 0.5 }));
    drawFrame(ctx, race, { ...baseOptions, capSeconds: 720 });
    const fills = rects.filter((rect) => rect[3] === 28);
    // Track plus fill for each of the three athletes.
    expect(fills.length).toBeGreaterThanOrEqual(6);
  });

  const raceOptions = (extra: Record<string, unknown> = {}) => ({
    ...baseOptions,
    capSeconds: 720,
    movements: [
      { name: 'Air Squats', reps: 10, unit: null },
      { name: 'Hand-Release Push-ups', reps: 10, unit: null },
    ],
    ...extra,
  });
  const raceFrame = (participants = 3) => ({
    ...frameAt(data(participants)),
    phase: 'race' as const,
    clockSeconds: 300,
    cardBlend: 0,
  });

  it('names the workout, because a bar chart does not say what it counts', () => {
    // Someone who was not there cannot tell what "12 rounds" is 12 of.
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, raceFrame(), raceOptions());
    const all = texts.map((entry) => entry.text);
    expect(all).toContain('THE WORKOUT');
    expect(all).toContain('10 Air Squats');
    expect(all).toContain('10 Hand-Release Push-ups');
  });

  it('puts it bottom left, inside the safe area', () => {
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, raceFrame(), raceOptions());
    const label = texts.find((entry) => entry.text === 'THE WORKOUT')!;
    expect(label.x).toBe(72);
    expect(label.y).toBeGreaterThan(1920 / 2);
    for (const entry of texts) {
      expect(entry.y).toBeLessThan(1920 - 300 + 80);
    }
  });

  it('takes the space from the bars rather than drawing over them', () => {
    // The bars are what the replay is for; overlapping them would be worse
    // than omitting the workout.
    const { ctx, texts, rects } = recordingCtx();
    drawFrame(ctx, raceFrame(6), raceOptions());
    const label = texts.find((entry) => entry.text === 'THE WORKOUT')!;
    const tracks = rects.filter((rect) => rect[3] === 28);
    expect(tracks.length).toBeGreaterThan(0);
    for (const track of tracks) {
      expect(track[1]! + track[3]!).toBeLessThanOrEqual(label.y);
    }
  });

  it('gives way entirely when the race cannot spare the rows', () => {
    // Landscape leaves 184px below the clock — enough for one bar and nothing
    // else.
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, raceFrame(), raceOptions({ layout: 'landscape' as const }));
    expect(texts.map((entry) => entry.text)).not.toContain('THE WORKOUT');
  });

  it('caps a long workout instead of papering the frame with it', () => {
    const { ctx, texts } = recordingCtx();
    drawFrame(
      ctx,
      raceFrame(),
      raceOptions({
        movements: ['Air Squats', 'Push-ups', 'Sit-ups', 'Burpees', 'Lunges', 'Planks'].map(
          (name) => ({ name, reps: 10, unit: null })
        ),
      })
    );
    const drawn = ['Air Squats', 'Push-ups', 'Sit-ups', 'Burpees', 'Lunges', 'Planks'].filter(
      (name) => texts.some((entry) => entry.text.includes(name))
    );
    expect(drawn).toHaveLength(4);
  });

  it('shows nothing when there is no workout to name', () => {
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, raceFrame(), raceOptions({ movements: [] }));
    expect(texts.map((entry) => entry.text)).not.toContain('THE WORKOUT');
  });

  it('renders the card alone once the crossfade completes', () => {
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(data(3)), { ...baseOptions, capSeconds: 720 });
    expect(texts.map((entry) => entry.text)).toContain('7 rounds + 12');
  });
});

describe('the card actually shows the result', () => {
  function fullCard(): ReplayData {
    const base = data(1);
    base.mission.workout = {
      movements: [
        { name: 'Air Squats', reps: 10 },
        { name: 'Hand-Release Push-ups', reps: 10 },
      ],
    };
    base.rounds = [8, 18, 28, 38, 68, 98, 139].map((atSeconds, index) => ({
      participantId: 'p0',
      n: index + 1,
      atSeconds,
    }));
    return base;
  }

  const richOptions = (extra: Record<string, unknown> = {}) => ({
    ...baseOptions,
    movements: [
      { name: 'Air Squats', reps: 10, unit: null },
      { name: 'Hand-Release Push-ups', reps: 10, unit: null },
    ],
    splits: [
      { n: 1, seconds: 8 },
      { n: 2, seconds: 10 },
      { n: 3, seconds: 41 },
    ],
    totalReps: 140,
    finalScore: 119,
    showBoard: false,
    ...extra,
  });

  it('names the movements, which the first card omitted entirely', () => {
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(fullCard()), richOptions());
    const all = texts.map((entry) => entry.text);
    expect(all).toContain('10 Air Squats');
    expect(all).toContain('10 Hand-Release Push-ups');
    expect(all).toContain('THE WORKOUT');
  });

  it('darkens a band behind the round splits, over the bars themselves', () => {
    // Regression: the only scrim was a gradient at fixed fractions of the card
    // height, tuned for the story ratio. On the square card its lightest
    // stretch fell across the chart, and since the bars are drawn a shade
    // lighter than the near-black background, a bright photo inverted that and
    // the bars stopped reading. Found by rendering a real card with a real
    // photo on a sunlit lawn, not by a test.
    const { ctx, rects } = recordingCtx();
    drawFrame(ctx, frameAt(fullCard()), {
      ...richOptions(),
      photo: {} as unknown as CanvasImageSource,
      photoWidth: 4032,
      photoHeight: 3024,
    });

    // The three splits are the only rects sharing one width; the footer rule
    // and the band are each on their own.
    const byWidth = new Map<number, number[][]>();
    for (const rect of rects.filter((entry) => entry[2]! < 1080)) {
      byWidth.set(rect[2]!, [...(byWidth.get(rect[2]!) ?? []), rect]);
    }
    const bars = [...byWidth.values()].find((group) => group.length === 3);
    expect(bars).toBeDefined();
    const band = rects.find((rect) => rect[0] === 0 && rect[2] === 1080 && rect[3]! < 1920);
    expect(band).toBeDefined();

    const bandTop = band![1]!;
    const bandBottom = bandTop + band![3]!;
    for (const bar of bars!) {
      expect(bar[1]!).toBeGreaterThanOrEqual(bandTop);
      expect(bar[1]! + bar[3]!).toBeLessThanOrEqual(bandBottom);
    }
  });

  it('draws no band when the card carries no photo', () => {
    const { ctx, rects } = recordingCtx();
    drawFrame(ctx, frameAt(fullCard()), richOptions());
    expect(rects.some((rect) => rect[0] === 0 && rect[2] === 1080 && rect[3]! < 1920)).toBe(false);
  });

  it('draws the round splits with their times', () => {
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(fullCard()), richOptions());
    const all = texts.map((entry) => entry.text);
    expect(all).toContain('ROUND SPLITS');
    expect(all).toContain('0:08');
    expect(all).toContain('0:41');
  });

  it('shows the totals the scorecard shows', () => {
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(fullCard()), richOptions());
    expect(texts.map((entry) => entry.text)).toContain('140 reps  ·  score 119');
  });

  it('omits the one-row board on a solo mission', () => {
    // A single leaderboard row restates the hero, and left the first card
    // roughly two thirds empty.
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(fullCard()), richOptions());
    expect(texts.filter((entry) => entry.text === '1')).toHaveLength(0);
  });

  it('still draws the board when there is a squad', () => {
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(data(4)), richOptions({ showBoard: true }));
    expect(texts.map((entry) => entry.text)).toContain('Athlete 1');
  });

  it('fills the card instead of leaving the lower two thirds empty', () => {
    // The concrete complaint about the first version.
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(fullCard()), richOptions());
    const lowest = Math.max(...texts.map((entry) => entry.y));
    expect(lowest).toBeGreaterThan(1000);
  });
  const landscape = (extra: Record<string, unknown> = {}) => ({
    ...baseOptions,
    layout: 'landscape' as const,
    movements: [
      { name: 'Air Squats', reps: 10, unit: null },
      { name: 'Hand-Release Push-ups', reps: 10, unit: null },
      { name: 'Sit-ups', reps: 20, unit: null },
      { name: 'Burpees', reps: 5, unit: null },
    ],
    totalReps: 428,
    finalScore: 738,
    showBoard: false,
    ...extra,
  });

  it('never overprints one split label on the next', () => {
    // Regression: a 24-round card printed "0:270:100:100:10..." along the
    // bottom of the chart. Bars stay legible however many there are, so the
    // chart looked right until you tried to read a time. Found on a real
    // card, not by a test.
    const many = fullCard();
    many.rounds = Array.from({ length: 24 }, (_, index) => ({
      participantId: 'p0',
      n: index + 1,
      atSeconds: (index + 1) * 12,
    }));
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(many), {
      ...richOptions(),
      splits: Array.from({ length: 24 }, (_, index) => ({ n: index + 1, seconds: 12 })),
    });

    const labels = texts.filter((entry) => /^\d+:\d\d$/.test(entry.text)).sort((a, b) => a.x - b.x);
    expect(labels.length).toBeGreaterThan(0);
    for (let i = 1; i < labels.length; i += 1) {
      const size = Number(/(\d+)px/.exec(labels[i]!.font)?.[1] ?? 24);
      const width = labels[i]!.text.length * size * 0.55;
      // Labels are centred, so neighbours clear when the gap exceeds a width.
      expect(labels[i]!.x - labels[i - 1]!.x).toBeGreaterThanOrEqual(width);
    }
  });

  it('still labels every bar on a chart that has room', () => {
    // Ten rounds fit today and must keep fitting -- thinning is for the
    // charts that cannot, not a blanket reduction.
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(fullCard()), richOptions());
    const labels = texts.filter((entry) => /^\d+:\d\d$/.test(entry.text));
    expect(labels).toHaveLength(3);
  });

  it('keeps the slowest round labelled when it thins the rest', () => {
    // The accent bar is why the chart is on the card.
    const seconds = Array.from({ length: 24 }, (_, index) => (index === 9 ? 90 : 12));
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(fullCard()), {
      ...richOptions(),
      splits: seconds.map((value, index) => ({ n: index + 1, seconds: value })),
    });
    expect(texts.some((entry) => entry.text === '1:30')).toBe(true);
  });

  it('draws nothing below the bottom edge', () => {
    // Regression: the card is 608px tall and inherited the story's type scale,
    // whose block stack needs about 740px. The workout ran off the bottom and
    // the footer link was pinned on top of it. Found on a real Facebook
    // unfurl, not by a test.
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(fullCard()), landscape());
    expect(texts.length).toBeGreaterThan(0);
    for (const entry of texts) {
      expect(entry.y).toBeGreaterThanOrEqual(0);
      expect(entry.y).toBeLessThan(608);
    }
  });

  it('draws the watermark, which used to land past the canvas', () => {
    // It was placed at footerY + 72 = 616 on a 608px card, so it was never
    // drawn at all -- the brand was missing from the one card strangers see.
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(fullCard()), landscape());
    const wordmark = texts.find((entry) => entry.text === 'AMRAP With Friends');
    expect(wordmark).toBeDefined();
    expect(wordmark!.y).toBeLessThan(608);
  });

  it('keeps the link clear of the workout instead of printing one over the other', () => {
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(fullCard()), landscape());
    const link = texts.find((entry) => entry.text.startsWith('amrapwithfriends.com'));
    const movements = texts.filter((entry) => entry.text.includes('Air Squats'));
    expect(link).toBeDefined();
    for (const movement of movements) {
      expect(movement.y).toBeLessThan(link!.y);
    }
  });

  it('drops movements that will not fit rather than slicing the last one', () => {
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(fullCard()), landscape());
    const names = ['10 Air Squats', '10 Hand-Release Push-ups', '20 Sit-ups', '5 Burpees'];
    const drawn = names.filter((name) => texts.some((entry) => entry.text === name));
    // Whatever is drawn must be whole and on the card. Four fit today; the
    // guarantee is the bound, not the number.
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.length).toBeLessThanOrEqual(names.length);
  });

  it('still leads with the score, at a size the 608px card can hold', () => {
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(fullCard()), landscape());
    const hero = texts.find((entry) => entry.text === '7 rounds + 12');
    expect(hero).toBeDefined();
    const size = Number(/(\d+)px/.exec(hero!.font)?.[1]);
    // Still by far the largest thing on the card, and still the first thing
    // drawn after the title.
    expect(size).toBeGreaterThan(60);
    expect(size).toBeLessThan(160);
    const subtitle = texts.find((entry) => entry.text.startsWith('12 min AMRAP'));
    expect(size).toBeGreaterThan(Number(/(\d+)px/.exec(subtitle!.font)?.[1]));
  });

  it('leaves the story card exactly as it was', () => {
    // The two ratios the athlete posts render correctly today; this fix must
    // not move them.
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(fullCard()), richOptions());
    // 128 rather than the 160 of TYPE_SCALE.display because fitFontSize
    // already shrank this score to the card width -- which is exactly the
    // point: this is the number main produces, and it must not move.
    const hero = texts.find((entry) => entry.text === '7 rounds + 12');
    expect(/(\d+)px/.exec(hero!.font)?.[1]).toBe('128');
  });
});

describe('the hero fits instead of being cut off', () => {
  function scored(rounds: number, reps: number): ReplayData {
    const base = data(1);
    base.participants[0]!.finalRounds = rounds;
    base.participants[0]!.finalReps = reps;
    return base;
  }

  function heroSize(texts: DrawnText[], text: string): number {
    const entry = texts.find((item) => item.text === text);
    return Number(/(\d+)px/.exec(entry?.font ?? '')?.[1] ?? 0);
  }

  it('never ellipsises the score, which is the point of the card', () => {
    // The shipped bug: "4 rounds + 24" clipped to "4 rounds +…" at 160px,
    // losing exactly the number somebody is posting.
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(scored(4, 24)), baseOptions);
    const all = texts.map((entry) => entry.text);
    expect(all).toContain('4 rounds + 24');
    expect(all.some((text) => text.includes('…') && text.includes('rounds'))).toBe(false);
  });

  it('shrinks the type to make it fit', () => {
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(scored(4, 24)), baseOptions);
    const size = heroSize(texts, '4 rounds + 24');
    expect(size).toBeLessThan(160);
    expect(size).toBeGreaterThanOrEqual(72);
  });

  it('leaves a short score at full size', () => {
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(scored(7, 0)), baseOptions);
    expect(heroSize(texts, '7 rounds')).toBe(160);
  });

  it('keeps everything below the hero inside the card as it shrinks', () => {
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(scored(12, 199)), baseOptions);
    for (const entry of texts) {
      expect(entry.y).toBeLessThan(1920);
    }
  });
});

describe('the athlete photo', () => {
  const photoOptions = {
    ...baseOptions,
    photo: {} as unknown as CanvasImageSource,
    photoWidth: 4032,
    photoHeight: 3024,
  };

  it('draws the photo behind everything, then a scrim over it', () => {
    const { ctx, images, rects } = recordingCtx();
    drawFrame(ctx, frameAt(data(1)), photoOptions);
    expect(images).toHaveLength(1);
    // Cover-fit: wider than the card, full height, centred.
    expect(images[0]!.width).toBeGreaterThan(1080);
    expect(images[0]!.height).toBeCloseTo(1920, 0);
    // A full-bleed rect after the image is the scrim.
    expect(rects.some((rect) => rect[2] === 1080 && rect[3] === 1920)).toBe(true);
  });

  it('still draws the result on top of the photo', () => {
    const { ctx, texts } = recordingCtx();
    drawFrame(ctx, frameAt(data(1)), photoOptions);
    const all = texts.map((entry) => entry.text);
    expect(all).toContain('The Hull Breach');
    expect(all).toContain('7 rounds + 12');
  });

  it('draws no photo layer when there is none', () => {
    const { ctx, images } = recordingCtx();
    drawFrame(ctx, frameAt(data(1)), baseOptions);
    expect(images).toHaveLength(0);
  });

  it('ignores a photo with no dimensions rather than drawing a zero-sized image', () => {
    const { ctx, images } = recordingCtx();
    drawFrame(ctx, frameAt(data(1)), { ...photoOptions, photoWidth: 0, photoHeight: 0 });
    expect(images).toHaveLength(0);
  });
});
