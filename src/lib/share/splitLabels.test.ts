import { describe, expect, it } from 'vitest';
import { splitLabelIndices, splitLabelSize } from '@/lib/share/splitLabels';

describe('splitLabelIndices', () => {
  it('labels every bar when they all fit', () => {
    // Ten rounds at 94px pitch, which is what a real 10-round card gives.
    const indices = splitLabelIndices({ count: 10, pitch: 94, labelWidth: 53, slowestIndex: 4 });
    expect(indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('never lets two labels overlap', () => {
    // Regression: a 24-round card printed "0:270:100:100:10..." across the
    // bottom of the chart. Found on a real card, not by a test.
    const pitch = 39;
    const labelWidth = 53;
    const indices = splitLabelIndices({ count: 24, pitch, labelWidth, slowestIndex: 0 });
    for (let i = 1; i < indices.length; i += 1) {
      const distance = (indices[i]! - indices[i - 1]!) * pitch;
      expect(distance).toBeGreaterThanOrEqual(labelWidth);
    }
    expect(indices.length).toBeLessThan(24);
    expect(indices.length).toBeGreaterThan(0);
  });

  it('always keeps the slowest round, which is the accent bar', () => {
    // The chart is on the card to show where it fell apart; that is the one
    // time worth reading.
    const indices = splitLabelIndices({ count: 30, pitch: 31, labelWidth: 53, slowestIndex: 17 });
    expect(indices).toContain(17);
  });

  it('keeps the ends when they clear, so the chart is anchored', () => {
    const indices = splitLabelIndices({ count: 24, pitch: 39, labelWidth: 53, slowestIndex: 11 });
    expect(indices).toContain(0);
    expect(indices).toContain(23);
  });

  it('drops an end rather than overlapping the slowest round next to it', () => {
    // Priority is the point: the accent bar wins a collision.
    const indices = splitLabelIndices({ count: 24, pitch: 39, labelWidth: 53, slowestIndex: 1 });
    expect(indices).toContain(1);
    expect(indices).not.toContain(0);
  });

  it('handles a single round and an empty chart', () => {
    expect(splitLabelIndices({ count: 1, pitch: 900, labelWidth: 53, slowestIndex: 0 })).toEqual([
      0,
    ]);
    expect(splitLabelIndices({ count: 0, pitch: 39, labelWidth: 53, slowestIndex: 0 })).toEqual([]);
  });

  it('draws nothing rather than dividing by a zero pitch', () => {
    expect(splitLabelIndices({ count: 5, pitch: 0, labelWidth: 53, slowestIndex: 0 })).toEqual([]);
  });
});

describe('splitLabelSize', () => {
  const widthAt = (size: number) => size * 2.2; // "0:10" is about 4 chars

  it('keeps the largest size that fits', () => {
    expect(splitLabelSize([24, 21, 18], 100, widthAt)).toBe(24);
  });

  it('steps down to one that fits', () => {
    // 24 -> 52.8 + 8 > 55; 21 -> 46.2 + 8 = 54.2 <= 55.
    expect(splitLabelSize([24, 21, 18], 55, widthAt)).toBe(21);
  });

  it('bottoms out at the smallest and leaves the rest to thinning', () => {
    // Shrinking alone cannot rescue a 24-round chart, and type small enough
    // for all of them would be too small for any of them.
    expect(splitLabelSize([24, 21, 18], 20, widthAt)).toBe(18);
  });
});
