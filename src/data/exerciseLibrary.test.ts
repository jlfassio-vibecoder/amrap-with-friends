import { describe, it, expect } from 'vitest';
import { getExerciseInfo } from './exerciseLibrary';

describe('getExerciseInfo', () => {
  it('returns the Burpees entry when found', () => {
    const info = getExerciseInfo('Burpees');
    expect(info?.id).toBe('burpees');
    expect(info?.name).toBe('Burpees');
  });

  it('matches case-insensitively', () => {
    expect(getExerciseInfo('burpees')?.id).toBe('burpees');
    expect(getExerciseInfo('BURPEES')?.id).toBe('burpees');
  });

  it('returns undefined when no entry exists', () => {
    expect(getExerciseInfo('Air Squats')).toBeUndefined();
  });

  it('does not fuzzy-match distinct push-up variants', () => {
    expect(getExerciseInfo('Push-ups')).toBeUndefined();
    expect(getExerciseInfo('Hand-Release Push-ups')).toBeUndefined();
    expect(getExerciseInfo('Standard Push-ups')).toBeUndefined();
  });
});
