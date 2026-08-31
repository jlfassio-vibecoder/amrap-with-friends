import { describe, expect, it } from 'vitest';
import { resolveWorkoutTitle } from './resolveWorkoutTitle';

describe('resolveWorkoutTitle', () => {
  it('returns the built-in template name', () => {
    expect(resolveWorkoutTitle('the-pendulum')).toBe('The Pendulum');
  });

  it('falls back for custom and unknown ids', () => {
    expect(resolveWorkoutTitle(null)).toBe('Workout');
    expect(resolveWorkoutTitle(undefined)).toBe('Workout');
    expect(resolveWorkoutTitle('coach:00000000-0000-0000-0000-000000000000')).toBe('Workout');
    expect(resolveWorkoutTitle('not-a-real-template')).toBe('Workout');
  });
});
