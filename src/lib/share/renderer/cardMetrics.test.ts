import { describe, expect, it } from 'vitest';
import {
  MAX_OVERLAY_MOVEMENTS,
  cardMetrics,
  cardScale,
  footerHeight,
  raceMovementOverlay,
} from '@/lib/share/renderer/cardMetrics';
import { LAYOUTS, TYPE_SCALE } from '@/lib/share/renderer/theme';

describe('cardScale', () => {
  it('leaves story and square untouched', () => {
    // These two render correctly today; the fix must not move them a pixel.
    expect(cardScale(LAYOUTS.story)).toBe(1);
    expect(cardScale(LAYOUTS.square)).toBe(1);
  });

  it('shrinks landscape, whose content band is a third of the story', () => {
    const scale = cardScale(LAYOUTS.landscape);
    expect(scale).toBeLessThan(1);
    expect(scale).toBeGreaterThan(0.3);
  });

  it('never shrinks past a floor, however short the card', () => {
    // Below this the hero stops being the point of the card.
    expect(cardScale({ width: 1080, height: 200, safeTop: 72, safeBottom: 72 })).toBe(0.5);
  });
});

describe('cardMetrics', () => {
  it('hands story the type scale unchanged', () => {
    const metrics = cardMetrics(LAYOUTS.story);
    expect(metrics.display).toBe(TYPE_SCALE.display);
    expect(metrics.hero).toBe(TYPE_SCALE.hero);
    expect(metrics.subtitle).toBe(TYPE_SCALE.body);
    expect(metrics.gap).toBe(1);
  });

  it('keeps the hero the largest thing on a landscape card', () => {
    const metrics = cardMetrics(LAYOUTS.landscape);
    expect(metrics.display).toBeGreaterThan(metrics.hero);
    expect(metrics.hero).toBeGreaterThan(metrics.title);
    expect(metrics.title).toBeGreaterThan(metrics.subtitle);
  });
});

describe('footerHeight', () => {
  it('is one line when there is no watermark', () => {
    const metrics = cardMetrics(LAYOUTS.landscape);
    expect(footerHeight(metrics, false)).toBe(metrics.footer);
  });

  it('covers the rule and the wordmark when there is one', () => {
    // Regression: the footer was placed from its first line, so on the 608px
    // card the watermark was drawn at y=616 and simply never appeared.
    const metrics = cardMetrics(LAYOUTS.landscape);
    const height = footerHeight(metrics, true);
    expect(height).toBeGreaterThan(metrics.footer + metrics.watermark);
    expect(LAYOUTS.landscape.safeBottom + height).toBeLessThan(LAYOUTS.landscape.height);
  });
});

describe('raceMovementOverlay', () => {
  const story = cardMetrics(LAYOUTS.story);
  const base = {
    metrics: story,
    movementCount: 2,
    available: 1090,
    reservedRows: 3,
    rowHeight: 104,
  };

  it('fits under the bars on a story replay', () => {
    const overlay = raceMovementOverlay(base);
    expect(overlay).not.toBeNull();
    expect(overlay!.lines).toBe(2);
    expect(overlay!.height).toBeLessThan(1090 - 3 * 104);
  });

  it('caps a long workout rather than papering the frame with it', () => {
    // Context, not the subject. Past four it is a wall of text over a moving
    // chart.
    const overlay = raceMovementOverlay({ ...base, movementCount: 9 });
    expect(overlay!.lines).toBe(MAX_OVERLAY_MOVEMENTS);
  });

  it('gives way when the race would lose its rows', () => {
    // Landscape leaves 184px for bars; spending it on the workout would
    // explain a race nobody can see.
    const overlay = raceMovementOverlay({ ...base, available: 184 });
    expect(overlay).toBeNull();
  });

  it('is skipped when there is no workout to show', () => {
    expect(raceMovementOverlay({ ...base, movementCount: 0 })).toBeNull();
  });

  it('scales with the card, so a shorter frame gets smaller type', () => {
    const wide = raceMovementOverlay({
      ...base,
      metrics: cardMetrics(LAYOUTS.landscape),
      available: 1090,
    });
    expect(wide!.size).toBeLessThan(story.subtitle);
  });
});
