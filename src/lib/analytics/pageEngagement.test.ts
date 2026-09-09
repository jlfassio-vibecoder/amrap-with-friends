import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendContentEvent } = vi.hoisted(() => ({ sendContentEvent: vi.fn() }));
vi.mock('@/lib/analytics/contentBeacon', () => ({ sendContentEvent }));

import {
  computeDwellSec,
  computeScrollDepthPct,
  reportPageEngagement,
} from '@/lib/analytics/pageEngagement';

describe('computeScrollDepthPct', () => {
  it('calls a page that fits on one screen fully read', () => {
    // Otherwise every short page would look like a bounce forever.
    expect(computeScrollDepthPct({ scrollY: 0, viewportHeight: 900, documentHeight: 900 })).toBe(
      100
    );
    expect(computeScrollDepthPct({ scrollY: 0, viewportHeight: 900, documentHeight: 400 })).toBe(
      100
    );
  });

  it('measures the scrolled fraction of a long page', () => {
    expect(computeScrollDepthPct({ scrollY: 0, viewportHeight: 1000, documentHeight: 3000 })).toBe(
      0
    );
    expect(
      computeScrollDepthPct({ scrollY: 1000, viewportHeight: 1000, documentHeight: 3000 })
    ).toBe(50);
    expect(
      computeScrollDepthPct({ scrollY: 2000, viewportHeight: 1000, documentHeight: 3000 })
    ).toBe(100);
  });

  it('clamps rubber-band overscroll and bogus geometry', () => {
    // iOS reports a negative scrollY at the top and an overshoot at the bottom.
    expect(
      computeScrollDepthPct({ scrollY: -200, viewportHeight: 1000, documentHeight: 3000 })
    ).toBe(0);
    expect(
      computeScrollDepthPct({ scrollY: 9999, viewportHeight: 1000, documentHeight: 3000 })
    ).toBe(100);
    expect(
      computeScrollDepthPct({ scrollY: 0, viewportHeight: 1000, documentHeight: Number.NaN })
    ).toBe(100);
  });
});

describe('computeDwellSec', () => {
  it('rounds to whole seconds', () => {
    expect(computeDwellSec(1000, 5400)).toBe(4);
  });

  it('caps at an hour, so a tab left open overnight cannot skew a median', () => {
    expect(computeDwellSec(0, 86_400_000)).toBe(3600);
  });

  it('never goes negative when a clock jumps backwards', () => {
    expect(computeDwellSec(5000, 1000)).toBe(0);
  });
});

describe('reportPageEngagement', () => {
  beforeEach(() => {
    sendContentEvent.mockReset();
  });

  it('sends the path with what was seen', () => {
    reportPageEngagement({ path: '/guides/what-is-amrap', maxScrollPct: 78, dwellSec: 141 });
    expect(sendContentEvent).toHaveBeenCalledWith('content_page_engaged', {
      path: '/guides/what-is-amrap',
      max_scroll_pct: 78,
      dwell_sec: 141,
    });
  });
});
