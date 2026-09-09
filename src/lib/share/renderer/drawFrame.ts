import { boardRows, formatScore, myBar, type FrameState } from '@/lib/share/timeline';
import { formatClockSeconds } from '@/lib/share/replay/frames';
import {
  formatMovement,
  formatSplit,
  type CardMovement,
  type RoundSplit,
} from '@/lib/share/cardContent';
import {
  AWF_THEME,
  LAYOUTS,
  SAFE_AREA,
  SHARE_FONT_STACK,
  TYPE_SCALE,
  type ShareTheme,
} from '@/lib/share/renderer/theme';
import type { ShareLayout, ShareVariant } from '@/lib/share/types';

export interface DrawFrameOptions {
  layout: ShareLayout;
  variant: ShareVariant;
  title: string;
  subtitle: string;
  shareUrl: string;
  watermark: boolean;
  theme?: ShareTheme;
  /** Set for replay frames; the card omits it. */
  capSeconds?: number;
  /** What the workout was. The first card omitted this entirely. */
  movements?: CardMovement[];
  /** Per-round durations — the shape of the effort, and the most interesting thing on the card. */
  splits?: RoundSplit[];
  totalReps?: number | null;
  finalScore?: number | null;
  /** False on a solo mission, where a one-row board just restates the hero. */
  showBoard?: boolean;
}

/**
 * The whole card, in Canvas 2D with no DOM and no React.
 *
 * That constraint is the point: Phase 2 runs this exact function in a Worker
 * against an OffscreenCanvas, and a server renderer could run it against
 * node-canvas unchanged. Anything that reaches for `document` here forecloses
 * both.
 *
 * Takes a rendering context rather than a canvas so the caller owns sizing —
 * a Worker and a preview size differently.
 */
export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function font(size: number, weight: 400 | 600 | 800 = 600): string {
  return `${weight} ${size}px ${SHARE_FONT_STACK}`;
}

/**
 * Shrinks the type until the line fits, and returns the size used.
 *
 * The hero is the number the whole card exists to show, and ellipsising it —
 * "4 rounds +…" — loses exactly the part that matters. A score with partial
 * reps is wider than a round number, so the first version fitted "7 rounds"
 * and clipped "4 rounds + 24". Shrinking a step or two is invisible; a
 * truncated headline is not.
 *
 * Steps down rather than solving for the width because the fit depends on the
 * font's own metrics, which are only knowable by measuring.
 */
export function fitFontSize(
  ctx: Ctx,
  text: string,
  maxWidth: number,
  startSize: number,
  weight: 400 | 600 | 800,
  minSize: number
): number {
  let size = startSize;
  while (size > minSize) {
    ctx.font = font(size, weight);
    if (ctx.measureText(text).width <= maxWidth) {
      return size;
    }
    size -= 4;
  }
  ctx.font = font(minSize, weight);
  return minSize;
}

/** Truncates to fit, so a long name pushes nothing off the card. */
function fitText(ctx: Ctx, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }
  let trimmed = text;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
}

/**
 * The live phases: a clock, and one bar per athlete that grows as their rounds
 * land. Crossfades into the card during the freeze via `cardBlend`, which is
 * why both live in one function — a separate replay renderer would drift from
 * the card it hands over to.
 */
function drawRaceFrame(ctx: Ctx, frame: FrameState, options: DrawFrameOptions): void {
  const theme = options.theme ?? AWF_THEME;
  const spec = LAYOUTS[options.layout];
  const left = SAFE_AREA;
  const contentWidth = spec.width - SAFE_AREA * 2;

  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, spec.width, spec.height);

  ctx.textBaseline = 'top';
  ctx.fillStyle = theme.secondary;
  ctx.font = font(TYPE_SCALE.body, 600);
  ctx.fillText(fitText(ctx, options.title, contentWidth), left, spec.safeTop);

  // The clock sits inside the safe area: on a Story it would otherwise be
  // under Instagram's own header.
  ctx.fillStyle = theme.ink;
  ctx.font = font(TYPE_SCALE.display, 800);
  ctx.fillText(
    formatClockSeconds(options.capSeconds ?? 0, frame.clockSeconds),
    left,
    spec.safeTop + TYPE_SCALE.body + 24
  );

  const barsTop = spec.safeTop + TYPE_SCALE.body + TYPE_SCALE.display + 80;
  const rowHeight = 104;
  const available = spec.height - spec.safeBottom - barsTop;
  const visible = Math.max(0, Math.min(frame.bars.length, Math.floor(available / rowHeight)));

  for (let index = 0; index < visible; index += 1) {
    const bar = frame.bars[index];
    if (!bar) {
      continue;
    }
    const y = barsTop + index * rowHeight;
    const trackWidth = contentWidth;
    const fillWidth = Math.max(6, trackWidth * Math.max(0, Math.min(1, bar.progress)));

    ctx.fillStyle = theme.surface;
    ctx.fillRect(left, y + 44, trackWidth, 28);
    ctx.fillStyle = bar.highlight ? theme.accent : theme.border;
    ctx.fillRect(left, y + 44, fillWidth, 28);

    // A round landing pops the bar. Decays over half a mission second, so it
    // reads as a beat rather than a flicker.
    if (bar.flash > 0) {
      ctx.globalAlpha = bar.flash;
      ctx.fillStyle = theme.ink;
      ctx.fillRect(left, y + 44, fillWidth, 28);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = bar.highlight ? theme.ink : theme.secondary;
    ctx.font = font(TYPE_SCALE.body, bar.highlight ? 800 : 600);
    ctx.fillText(fitText(ctx, bar.displayName, contentWidth - 260), left, y);

    ctx.textAlign = 'right';
    ctx.fillText(formatScore(bar), spec.width - SAFE_AREA, y);
    ctx.textAlign = 'left';
  }
}

export function drawFrame(ctx: Ctx, frame: FrameState, options: DrawFrameOptions): void {
  // Title and race are the live video; freeze is the card. The crossfade
  // between them is what makes the last two seconds land on the shareable
  // image rather than cutting to it.
  if (frame.phase !== 'freeze') {
    drawRaceFrame(ctx, frame, options);
    return;
  }
  if (frame.cardBlend < 1 && options.capSeconds !== undefined) {
    drawRaceFrame(ctx, frame, options);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, frame.cardBlend));
    drawCardFrame(ctx, frame, options);
    ctx.restore();
    return;
  }
  drawCardFrame(ctx, frame, options);
}

function drawCardFrame(ctx: Ctx, frame: FrameState, options: DrawFrameOptions): void {
  const theme = options.theme ?? AWF_THEME;
  const spec = LAYOUTS[options.layout];
  const { width, height } = spec;

  ctx.save();
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, width, height);

  const left = SAFE_AREA;
  const contentWidth = width - SAFE_AREA * 2;
  let y = spec.safeTop;

  // Header
  ctx.fillStyle = theme.secondary;
  ctx.font = font(TYPE_SCALE.body, 600);
  ctx.textBaseline = 'top';
  ctx.fillText(fitText(ctx, options.subtitle, contentWidth), left, y);
  y += TYPE_SCALE.body + 16;

  ctx.fillStyle = theme.ink;
  ctx.font = font(TYPE_SCALE.label, 800);
  ctx.fillText(fitText(ctx, options.title, contentWidth), left, y);
  y += TYPE_SCALE.label + 48;

  const me = myBar(frame.bars);
  const showHero = options.variant !== 'squad' && me !== null;

  if (showHero && me) {
    // Shrink to fit rather than clip: half the reason for the card is the
    // number, and "4 rounds + 24" is wider than "7 rounds".
    const score = formatScore(me);
    ctx.fillStyle = theme.accent;
    const scoreSize = fitFontSize(ctx, score, contentWidth, TYPE_SCALE.display, 800, 72);
    ctx.fillText(score, left, y);
    y += scoreSize + 8;

    // A name can be arbitrarily long, so it still truncates below a floor —
    // but it shrinks first, and a clipped name costs less than a clipped
    // score.
    ctx.fillStyle = theme.ink;
    const nameSize = fitFontSize(ctx, me.displayName, contentWidth, TYPE_SCALE.hero, 600, 48);
    ctx.fillText(fitText(ctx, me.displayName, contentWidth), left, y);
    y += nameSize + 16;

    // The numbers the app shows on the scorecard. Rounds alone reads as an
    // incomplete result next to the screen the athlete just closed.
    const totals: string[] = [];
    if (typeof options.totalReps === 'number') {
      totals.push(`${options.totalReps} reps`);
    }
    if (typeof options.finalScore === 'number') {
      totals.push(`score ${options.finalScore}`);
    }
    if (totals.length > 0) {
      ctx.fillStyle = theme.secondary;
      ctx.font = font(TYPE_SCALE.body, 600);
      ctx.fillText(totals.join('  ·  '), left, y);
      y += TYPE_SCALE.body + 40;
    } else {
      y += 40;
    }
  }

  // What the workout was. Omitting it made the card unreadable to anyone who
  // was not there — "7 rounds" of what?
  const movements = options.movements ?? [];
  if (movements.length > 0) {
    ctx.fillStyle = theme.secondary;
    ctx.font = font(32, 800);
    ctx.fillText('THE WORKOUT', left, y);
    y += 44;

    ctx.fillStyle = theme.ink;
    ctx.font = font(TYPE_SCALE.body, 600);
    for (const movement of movements.slice(0, 6)) {
      ctx.fillText(fitText(ctx, formatMovement(movement), contentWidth), left, y);
      y += TYPE_SCALE.body + 12;
    }
    y += 28;
  }

  // Splits. The bar chart is the only part of the card that shows how the
  // effort actually went, and it is what the scorecard shows the athlete
  // moments earlier — a card without it says less than the screen it came
  // from.
  const splits = options.splits ?? [];
  if (splits.length > 0 && options.layout !== 'landscape') {
    ctx.fillStyle = theme.secondary;
    ctx.font = font(32, 800);
    ctx.fillText('ROUND SPLITS', left, y);
    y += 52;

    const slowest = Math.max(...splits.map((split) => split.seconds), 1);
    // Sized from the space actually left rather than a constant: the first
    // version left roughly a third of the card empty beneath the chart. A
    // board, when there is one, gets its rows reserved first — the squad is
    // the point of a squad card, and the chart takes what is over.
    const boardReserve =
      options.variant !== 'amqap' && options.showBoard !== false
        ? Math.min(6, frame.bars.length) * 88 + 40
        : 0;
    const footerTop = height - spec.safeBottom - 40 - boardReserve;
    const chartHeight =
      options.layout === 'story'
        ? Math.max(200, Math.min(620, footerTop - y - 90))
        : Math.max(120, Math.min(300, footerTop - y - 90));
    const gap = 12;
    const barWidth = Math.max(
      8,
      Math.floor((contentWidth - gap * (splits.length - 1)) / Math.max(1, splits.length))
    );

    splits.forEach((split, index) => {
      const height = Math.max(6, Math.round((split.seconds / slowest) * chartHeight));
      const x = left + index * (barWidth + gap);
      // Slowest round in the accent: the moment it fell apart is the story.
      ctx.fillStyle = split.seconds === slowest ? theme.accent : theme.border;
      ctx.fillRect(x, y + (chartHeight - height), barWidth, height);

      ctx.fillStyle = theme.secondary;
      ctx.font = font(24, 600);
      ctx.textAlign = 'center';
      ctx.fillText(formatSplit(split.seconds), x + barWidth / 2, y + chartHeight + 12);
      ctx.textAlign = 'left';
    });
    y += chartHeight + 64;
  }

  // Squad board. The amqap variant deliberately has none — there is no score
  // to rank — and neither does a solo mission, where one row restates the hero.
  if (options.variant !== 'amqap' && options.showBoard !== false) {
    const rows = boardRows(frame.bars);
    const rowHeight = 88;
    const available = height - spec.safeBottom - y - 120;
    const visible = Math.max(0, Math.min(rows.length, Math.floor(available / rowHeight)));

    for (let index = 0; index < visible; index += 1) {
      const row = rows[index];
      if (!row) {
        continue;
      }
      const rowY = y + index * rowHeight;

      if (row.highlight) {
        ctx.fillStyle = theme.surface;
        ctx.fillRect(left - 16, rowY - 8, contentWidth + 32, rowHeight - 12);
      }

      ctx.fillStyle = row.highlight ? theme.accent : theme.secondary;
      ctx.font = font(TYPE_SCALE.body, 800);
      ctx.fillText(`${row.rank}`, left, rowY);

      ctx.fillStyle = theme.ink;
      ctx.font = font(TYPE_SCALE.body, row.highlight ? 800 : 600);
      ctx.fillText(fitText(ctx, row.displayName, contentWidth - 400), left + 80, rowY);

      const score = formatScore(row);
      ctx.textAlign = 'right';
      ctx.fillText(score, width - SAFE_AREA, rowY);
      ctx.textAlign = 'left';
    }
    y += visible * rowHeight;
  }

  // Footer: link, and the watermark bar on free cards.
  const footerY = height - spec.safeBottom + 8;
  ctx.fillStyle = theme.secondary;
  ctx.font = font(32, 600);
  ctx.fillText(fitText(ctx, options.shareUrl, contentWidth), left, footerY);

  if (options.watermark) {
    ctx.fillStyle = theme.accent;
    ctx.fillRect(left, footerY + 48, 120, 6);
    ctx.fillStyle = theme.secondary;
    ctx.font = font(28, 600);
    ctx.fillText('AMRAP With Friends', left, footerY + 72);
  }

  ctx.restore();
}
