import { describe, it, expect } from 'vitest';
import { formatWeekCountdown } from './formatWeekCountdown';

describe('formatWeekCountdown', () => {
  it('returns 00:00:00 when week has ended', () => {
    const now = Date.parse('2026-08-24T12:00:00.000Z');
    expect(formatWeekCountdown('2026-08-24T11:00:00.000Z', now)).toBe('00:00:00');
  });

  it('formats hours remaining without a day prefix', () => {
    const now = Date.parse('2026-08-24T12:00:00.000Z');
    expect(formatWeekCountdown('2026-08-24T15:30:45.000Z', now)).toBe('03:30:45');
  });

  it('formats multi-day remaining with day prefix', () => {
    const now = Date.parse('2026-08-24T12:00:00.000Z');
    expect(formatWeekCountdown('2026-08-26T14:05:09.000Z', now)).toBe('2d 02:05:09');
  });
});
