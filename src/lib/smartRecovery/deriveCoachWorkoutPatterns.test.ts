import { describe, expect, it } from 'vitest';
import type { PublishedCoachWorkout } from '@/lib/api/coachWod';
import {
  buildCoachWorkoutPatternIndex,
  coachWorkoutLockId,
  deriveCoachWorkoutPrimaryPatterns,
} from './deriveCoachWorkoutPatterns';

function coachWorkout(
  overrides: Partial<PublishedCoachWorkout> & Pick<PublishedCoachWorkout, 'id'>
): PublishedCoachWorkout {
  return {
    name: 'Coach workout',
    focus: null,
    durationMinutes: 10,
    intensityTier: 3,
    tags: [],
    notes: null,
    movements: [],
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('coachWorkoutLockId', () => {
  it('prefixes coach workout ids', () => {
    expect(coachWorkoutLockId('550e8400-e29b-41d4-a716-446655440000')).toBe(
      'coach:550e8400-e29b-41d4-a716-446655440000'
    );
  });
});

describe('deriveCoachWorkoutPrimaryPatterns', () => {
  it('derives patterns from movement names in the exercise library', () => {
    const patterns = deriveCoachWorkoutPrimaryPatterns(
      coachWorkout({
        id: 'w1',
        movements: [{ name: 'Burpees', exercise: null }],
      })
    );

    expect(patterns).toContain('full-body-conditioning');
  });

  it('falls back to linked exercise names when movement name is unknown', () => {
    const patterns = deriveCoachWorkoutPrimaryPatterns(
      coachWorkout({
        id: 'w2',
        movements: [
          {
            name: 'Custom label',
            exercise: {
              id: 'ex-1',
              name: 'Burpees',
              subtitle: null,
              instructions: [],
              cues: [],
              tips: null,
              photos: [],
            },
          },
        ],
      })
    );

    expect(patterns).toContain('full-body-conditioning');
  });

  it('returns empty patterns for unknown movements', () => {
    expect(
      deriveCoachWorkoutPrimaryPatterns(
        coachWorkout({
          id: 'w3',
          movements: [{ name: 'Totally Fake Movement', exercise: null }],
        })
      )
    ).toEqual([]);
  });

  it('caps results at two patterns', () => {
    const patterns = deriveCoachWorkoutPrimaryPatterns(
      coachWorkout({
        id: 'w4',
        movements: [
          { name: 'Burpees', exercise: null },
          { name: 'Air Squats', exercise: null },
          { name: 'Push-ups', exercise: null },
        ],
      })
    );

    expect(patterns.length).toBeLessThanOrEqual(2);
  });
});

describe('buildCoachWorkoutPatternIndex', () => {
  it('indexes coach workouts by coach lock id', () => {
    const workout = coachWorkout({
      id: 'w5',
      movements: [{ name: 'Burpees', exercise: null }],
    });
    const index = buildCoachWorkoutPatternIndex([workout]);

    expect(index.get(coachWorkoutLockId('w5'))).toContain('full-body-conditioning');
  });
});
