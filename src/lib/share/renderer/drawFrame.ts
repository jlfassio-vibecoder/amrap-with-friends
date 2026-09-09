import { boardRows, formatScore, myBar, type FrameState } from '@/lib/share/timeline';
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

export function drawFrame(ctx: Ctx, frame: FrameState, options: DrawFrameOptions): void {
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
    ctx.fillStyle = theme.accent;
    ctx.font = font(TYPE_SCALE.display, 800);
    ctx.fillText(fitText(ctx, formatScore(me), contentWidth), left, y);
    y += TYPE_SCALE.display + 8;

    ctx.fillStyle = theme.ink;
    ctx.font = font(TYPE_SCALE.hero, 600);
    ctx.fillText(fitText(ctx, me.displayName, contentWidth), left, y);
    y += TYPE_SCALE.hero + 56;
  }

  // Squad board. The amqap variant deliberately has none — there is no score
  // to rank, and a leaderboard would misrepresent what the flow is for.
  if (options.variant !== 'amqap') {
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
