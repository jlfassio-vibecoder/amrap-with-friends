/**
 * Type sizes and vertical rhythm for one card, given how tall it is.
 *
 * The card was written for the 1920px story and the other two ratios inherited
 * its type scale unchanged. Square survives that at 1080px. Landscape is
 * 608px, and the block stack needs about 740px — so the workout ran off the
 * bottom edge, the footer link was pinned over the top of it, and the
 * watermark was drawn at y=616 on a 608px canvas, which is to say not drawn at
 * all. That is what a real Facebook unfurl showed.
 *
 * Scaling the whole scale rather than hand-placing a second layout keeps one
 * composition across the three ratios: same order, same proportions, same
 * card, smaller.
 */
import { TYPE_SCALE, type LayoutSpec } from '@/lib/share/renderer/theme';

export interface CardMetrics {
  subtitle: number;
  title: number;
  hero: number;
  display: number;
  /** Floor passed to fitFontSize for the score, which shrinks before it truncates. */
  displayFloor: number;
  sectionLabel: number;
  footer: number;
  watermark: number;
  /** Multiplier applied to every gap between blocks. */
  gap: number;
}

/**
 * 1 for story and square, so neither changes by a pixel. Landscape gets the
 * ratio of its own content band to the story's, which is where the 740px stack
 * came from in the first place.
 */
export function cardScale(spec: LayoutSpec): number {
  if (spec.height >= 1080) {
    return 1;
  }
  const band = spec.height - spec.safeTop - spec.safeBottom;
  const storyBand = 1920 - 250 - 300;
  return Math.max(0.5, Math.min(1, band / storyBand));
}

export function cardMetrics(spec: LayoutSpec): CardMetrics {
  const scale = cardScale(spec);
  const round = (value: number): number => Math.round(value * scale);
  return {
    subtitle: round(TYPE_SCALE.body),
    title: round(TYPE_SCALE.label),
    hero: round(TYPE_SCALE.hero),
    display: round(TYPE_SCALE.display),
    displayFloor: round(72),
    sectionLabel: round(32),
    footer: round(32),
    watermark: round(28),
    gap: scale,
  };
}

/**
 * The height the footer block occupies, so it can be placed from the bottom of
 * itself rather than from its first line. Placed from the first line, the
 * watermark on a short card lands past the bottom edge.
 */
export function footerHeight(metrics: CardMetrics, watermark: boolean): number {
  if (!watermark) {
    return metrics.footer;
  }
  // Link, the gap to the accent rule, the gap from the rule to the wordmark,
  // and the wordmark itself — the same offsets the full-scale card uses.
  return (
    metrics.footer + Math.round(16 * metrics.gap) + Math.round(24 * metrics.gap) + metrics.watermark
  );
}

/**
 * Where the footer's first line sits.
 *
 * A full-scale card keeps the position it shipped with, which starts just
 * below the safe line and runs the watermark into it. That is arguably wrong
 * for a Story — the band exists because Instagram draws its own UI there — but
 * it is what every card already posted looks like, and correcting it is a
 * separate decision from making the landscape card fit. Only a compact card,
 * which had no working position at all, gets the computed one.
 */
export function footerTop(spec: LayoutSpec, metrics: CardMetrics, watermark: boolean): number {
  if (metrics.gap === 1) {
    return spec.height - spec.safeBottom + 8;
  }
  return (
    spec.height - spec.safeBottom - footerHeight(metrics, watermark) + Math.round(8 * metrics.gap)
  );
}
