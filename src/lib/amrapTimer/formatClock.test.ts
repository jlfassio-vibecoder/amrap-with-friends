import { describe, it, expect } from 'vitest';
import { formatClock } from '@/lib/amrapTimer/formatClock';

describe('formatClock', () => {
  it('pads minutes and seconds to two digits', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(9)).toBe('00:09');
    expect(formatClock(65)).toBe('01:05');
    expect(formatClock(20 * 60)).toBe('20:00');
  });

  it('shows an hours field only once there is an hour to show', () => {
    expect(formatClock(3599)).toBe('59:59');
    expect(formatClock(3600)).toBe('1:00:00');
    expect(formatClock(3661)).toBe('1:01:01');
  });

  it('clamps a countdown that overshoots rather than showing a negative clock', () => {
    expect(formatClock(-1)).toBe('00:00');
    expect(formatClock(-90)).toBe('00:00');
  });

  it('floors fractional seconds', () => {
    expect(formatClock(59.9)).toBe('00:59');
  });
});
