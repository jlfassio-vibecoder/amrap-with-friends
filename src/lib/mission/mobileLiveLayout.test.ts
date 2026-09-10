import { describe, expect, it } from 'vitest';
import {
  formatMobileLiveScoreLabel,
  hideMobileLiveChrome,
  shouldDenseMobileLiveWorkout,
  shouldOmitMobileLiveHowTo,
} from './mobileLiveLayout';

describe('hideMobileLiveChrome', () => {
  it('hides social chrome only while the mission is live', () => {
    expect(hideMobileLiveChrome('work')).toBe(true);
    expect(hideMobileLiveChrome('waiting')).toBe(false);
    expect(hideMobileLiveChrome('setup')).toBe(false);
    expect(hideMobileLiveChrome('finished')).toBe(false);
  });
});

describe('shouldOmitMobileLiveHowTo', () => {
  it('omits How to only during the live work phase', () => {
    expect(shouldOmitMobileLiveHowTo('work')).toBe(true);
    expect(shouldOmitMobileLiveHowTo('waiting')).toBe(false);
    expect(shouldOmitMobileLiveHowTo('finished')).toBe(false);
  });
});

describe('shouldDenseMobileLiveWorkout', () => {
  it('densifies only during live work with 4 or more movements', () => {
    expect(shouldDenseMobileLiveWorkout('work', 4)).toBe(true);
    expect(shouldDenseMobileLiveWorkout('work', 5)).toBe(true);
    expect(shouldDenseMobileLiveWorkout('work', 3)).toBe(false);
    expect(shouldDenseMobileLiveWorkout('waiting', 4)).toBe(false);
    expect(shouldDenseMobileLiveWorkout('finished', 4)).toBe(false);
  });
});

describe('formatMobileLiveScoreLabel', () => {
  it('matches the leaderboard reps readout when the workout has a round total', () => {
    expect(formatMobileLiveScoreLabel(20, 20, 1)).toBe('20 reps');
    expect(formatMobileLiveScoreLabel(40, 20, 2)).toBe('40 reps');
  });

  it('falls back to rounds when there is no reps-per-round total', () => {
    expect(formatMobileLiveScoreLabel(0, 0, 3)).toBe('3 rounds');
  });
});
