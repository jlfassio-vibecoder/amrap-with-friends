import { describe, it, expect } from 'vitest';
import { formatSplit, parseRoundSplits } from '@/lib/scoring/parseRoundSplits';

describe('parseRoundSplits', () => {
  it('reads mm:ss', () => {
    expect(parseRoundSplits('1:12 1:18 1:25').seconds).toEqual([72, 78, 85]);
  });

  it('reads plain seconds', () => {
    expect(parseRoundSplits('72, 78, 85').seconds).toEqual([72, 78, 85]);
  });

  it('accepts commas, spaces and newlines together', () => {
    expect(parseRoundSplits('1:12,\n1:18;  85').seconds).toEqual([72, 78, 85]);
  });

  it('reads tenths', () => {
    expect(parseRoundSplits('1:12.5 72.5').seconds).toEqual([72.5, 72.5]);
  });

  it('reports what it could not read rather than dropping it', () => {
    const parsed = parseRoundSplits('1:12 fast 1:75 1:18');
    expect(parsed.seconds).toEqual([72, 78]);
    expect(parsed.invalid).toEqual(['fast', '1:75']);
  });

  it('rejects zero and negative splits', () => {
    const parsed = parseRoundSplits('0 0:00 -5 60');
    expect(parsed.seconds).toEqual([60]);
    expect(parsed.invalid).toEqual(['0', '0:00', '-5']);
  });

  it('formats seconds back to a clock', () => {
    expect(formatSplit(72)).toBe('1:12');
    expect(formatSplit(9)).toBe('0:09');
    expect(formatSplit(600)).toBe('10:00');
  });
});
