import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GUEST_BROWSERS_WINDOW,
  GUEST_BROWSERS_WINDOWS,
  guestBrowsersCountLabel,
  guestBrowsersWindowLabel,
  isGuestBrowsersWindow,
  notesByBucketFromList,
} from './guestBrowsersWindows';

describe('guestBrowsersWindows', () => {
  it('defaults the panel to the 7d window', () => {
    expect(DEFAULT_GUEST_BROWSERS_WINDOW).toBe('7d');
  });

  it('lists the six allow-listed windows in range order', () => {
    expect(GUEST_BROWSERS_WINDOWS.map((row) => row.id)).toEqual([
      '24h',
      '3d',
      '7d',
      '30d',
      '90d',
      '365d',
    ]);
  });

  it('guards unknown window ids', () => {
    expect(isGuestBrowsersWindow('7d')).toBe(true);
    expect(isGuestBrowsersWindow('week')).toBe(false);
  });

  it('returns athlete-facing labels', () => {
    expect(guestBrowsersWindowLabel('24h')).toBe('Past 24 Hours');
    expect(guestBrowsersWindowLabel('30d')).toBe('Past Month');
    expect(guestBrowsersWindowLabel('365d')).toBe('Past 12 Months');
  });

  it('formats hover count copy by grain', () => {
    expect(guestBrowsersCountLabel(1, 'day')).toBe('1 guest');
    expect(guestBrowsersCountLabel(26, 'day')).toBe('26 guests');
    expect(guestBrowsersCountLabel(3, 'hour')).toBe('3 guests this hour');
  });

  it('maps notes by bucketStart', () => {
    expect(
      notesByBucketFromList([
        { bucketStart: 'a', body: 'one' },
        { bucketStart: 'b', body: 'two' },
      ])
    ).toEqual({ a: 'one', b: 'two' });
  });
});
