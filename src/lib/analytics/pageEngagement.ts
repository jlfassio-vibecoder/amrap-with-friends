import { sendContentEvent } from '@/lib/analytics/contentBeacon';

/**
 * How much of the page they actually saw, and for how long.
 *
 * A pageview cannot tell a two-second bounce from a full read of a
 * two-thousand-word guide, and that difference is the whole input to "which
 * content should we write more of". One beacon per pageview, on the way out.
 */

export interface PageEngagement {
  path: string;
  maxScrollPct: number;
  dwellSec: number;
}

/**
 * Percentage of the document that has been scrolled past the bottom of the
 * viewport. A page that fits on one screen is 100% read at a scroll of zero —
 * otherwise every short page would look like a bounce forever.
 */
export function computeScrollDepthPct(input: {
  scrollY: number;
  viewportHeight: number;
  documentHeight: number;
}): number {
  const { scrollY, viewportHeight, documentHeight } = input;
  if (!Number.isFinite(documentHeight) || documentHeight <= viewportHeight) {
    return 100;
  }
  const scrollable = documentHeight - viewportHeight;
  const pct = ((scrollY < 0 ? 0 : scrollY) / scrollable) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/**
 * Dwell is capped at an hour. A tab left open overnight is not an hour of
 * reading, and one such row would drag a median far more than it informs it.
 */
export function computeDwellSec(startedAtMs: number, nowMs: number): number {
  const seconds = Math.round((nowMs - startedAtMs) / 1000);
  return Math.max(0, Math.min(3600, seconds));
}

export function reportPageEngagement(engagement: PageEngagement): void {
  sendContentEvent('content_page_engaged', {
    path: engagement.path,
    max_scroll_pct: engagement.maxScrollPct,
    dwell_sec: engagement.dwellSec,
  });
}
