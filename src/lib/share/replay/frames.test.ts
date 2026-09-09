import { describe, expect, it } from 'vitest';
import { formatClockSeconds, frameSchedule } from '@/lib/share/replay/frames';

describe('frameSchedule', () => {
  it('includes the final frame, so the freeze is not cut short', () => {
    // 20s at 30fps is 600 intervals and 601 frames. Dropping the last one
    // loses 33ms of the hold every single time.
    expect(frameSchedule('full20').totalFrames).toBe(601);
    expect(frameSchedule('story9').totalFrames).toBe(271);
  });

  it('maps frame numbers onto video seconds', () => {
    const schedule = frameSchedule('full20');
    expect(schedule.timeAt(0)).toBe(0);
    expect(schedule.timeAt(300)).toBe(10);
    expect(schedule.timeAt(600)).toBe(20);
  });

  it('never runs past the end of the cut', () => {
    const schedule = frameSchedule('story9');
    expect(schedule.timeAt(9999)).toBe(9);
  });
});

describe('formatClockSeconds', () => {
  it('counts down the way a gym clock does', () => {
    expect(formatClockSeconds(720, 0)).toBe('12:00');
    expect(formatClockSeconds(720, 60)).toBe('11:00');
    expect(formatClockSeconds(720, 715)).toBe('0:05');
    expect(formatClockSeconds(720, 720)).toBe('0:00');
  });

  it('does not go negative in the grace window', () => {
    expect(formatClockSeconds(720, 900)).toBe('0:00');
  });

  it('rounds up, so 0:01 is shown until the second is actually gone', () => {
    expect(formatClockSeconds(720, 719.2)).toBe('0:01');
  });
});
