import { describe, it, expect } from 'vitest';
import { computeNextFeaturedOccurrences } from './featuredWodOccurrencePreview';

describe('computeNextFeaturedOccurrences', () => {
  it('returns an empty list when no days or times are given', () => {
    const now = new Date('2026-09-01T12:00:00.000Z');
    expect(computeNextFeaturedOccurrences([], ['06:00'], 'UTC', now, 3)).toEqual([]);
    expect(computeNextFeaturedOccurrences([1], [], 'UTC', now, 3)).toEqual([]);
  });

  it('returns an empty list for an unrecognized timezone', () => {
    const now = new Date('2026-09-01T12:00:00.000Z');
    expect(computeNextFeaturedOccurrences([1], ['06:00'], 'Not/AZone', now, 3)).toEqual([]);
  });

  it('finds the next occurrence today when the time is still ahead', () => {
    // 2026-09-01 is a Tuesday (day 2).
    const now = new Date('2026-09-01T10:00:00.000Z');
    const result = computeNextFeaturedOccurrences([2], ['18:00'], 'UTC', now, 1);
    expect(result).toHaveLength(1);
    expect(result[0].toISOString()).toBe('2026-09-01T18:00:00.000Z');
  });

  it("rolls over to the next matching day when today's time has already passed", () => {
    // 2026-09-01 (Tue) at 08:00 UTC has already passed relative to "now".
    const now = new Date('2026-09-01T10:00:00.000Z');
    const result = computeNextFeaturedOccurrences([2], ['08:00'], 'UTC', now, 1);
    expect(result).toHaveLength(1);
    // Next Tuesday is 2026-09-08.
    expect(result[0].toISOString()).toBe('2026-09-08T08:00:00.000Z');
  });

  it('returns multiple times per day in chronological order', () => {
    const now = new Date('2026-09-01T05:00:00.000Z');
    const result = computeNextFeaturedOccurrences([2], ['18:00', '06:00'], 'UTC', now, 2);
    expect(result.map((d) => d.toISOString())).toEqual([
      '2026-09-01T06:00:00.000Z',
      '2026-09-01T18:00:00.000Z',
    ]);
  });

  it('limits results to the requested count across multiple days', () => {
    const now = new Date('2026-09-01T00:00:00.000Z');
    // Every day, one time each — plenty of candidates in the 8-day window.
    const result = computeNextFeaturedOccurrences([0, 1, 2, 3, 4, 5, 6], ['06:00'], 'UTC', now, 3);
    expect(result).toHaveLength(3);
  });

  it('resolves a real IANA zone with a non-zero UTC offset correctly', () => {
    // 2026-09-01 is a Tuesday. 06:00 America/Los_Angeles in September is
    // PDT (UTC-7), so it should land at 13:00 UTC, not 06:00 UTC.
    const now = new Date('2026-09-01T00:00:00.000Z');
    const result = computeNextFeaturedOccurrences([2], ['06:00'], 'America/Los_Angeles', now, 1);
    expect(result).toHaveLength(1);
    expect(result[0].toISOString()).toBe('2026-09-01T13:00:00.000Z');
  });

  it('handles the US fall-back DST transition correctly', () => {
    // Nov 1, 2026 is a Sunday; US clocks fall back from PDT to PST at
    // 2:00am local on Nov 1, 2026. A 06:00 local time that day should
    // resolve using the new PST (UTC-8) offset, landing at 14:00 UTC —
    // not 13:00 UTC (which would be the pre-transition PDT offset).
    const now = new Date('2026-10-30T00:00:00.000Z');
    const result = computeNextFeaturedOccurrences([0], ['06:00'], 'America/Los_Angeles', now, 1);
    expect(result).toHaveLength(1);
    expect(result[0].toISOString()).toBe('2026-11-01T14:00:00.000Z');
  });
});
