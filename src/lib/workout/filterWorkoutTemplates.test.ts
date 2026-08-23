import { describe, it, expect } from 'vitest';
import {
  WORKOUT_CATEGORIES,
  WORKOUT_TEMPLATES,
  type TimeDomain,
} from '@/data/workoutTemplates';
import {
  filterWorkoutTemplates,
  firstAvailableCategoryForDuration,
  isCategoryAvailable,
  isDurationAvailable,
} from './filterWorkoutTemplates';

describe('filterWorkoutTemplates', () => {
  it('returns 10 Blood Shunt templates at 5 minutes', () => {
    expect(
      filterWorkoutTemplates(WORKOUT_TEMPLATES, {
        durationMinutes: 5,
        category: 'blood-shunt',
      })
    ).toHaveLength(10);
  });

  it('returns 10 Localized Trap templates at 5 minutes', () => {
    expect(
      filterWorkoutTemplates(WORKOUT_TEMPLATES, {
        durationMinutes: 5,
        category: 'localized-trap',
      })
    ).toHaveLength(10);
  });

  it('returns empty for categories with no seeded content', () => {
    expect(
      filterWorkoutTemplates(WORKOUT_TEMPLATES, {
        durationMinutes: 5,
        category: 'engine-room',
      })
    ).toEqual([]);
  });

  it('returns empty for durations with no templates', () => {
    for (const duration of [10, 15, 20] as TimeDomain[]) {
      expect(
        filterWorkoutTemplates(WORKOUT_TEMPLATES, {
          durationMinutes: duration,
          category: 'blood-shunt',
        })
      ).toEqual([]);
    }
  });
});

describe('isDurationAvailable', () => {
  it('is true only for 5 minutes today', () => {
    expect(isDurationAvailable(5, WORKOUT_TEMPLATES)).toBe(true);
    expect(isDurationAvailable(10, WORKOUT_TEMPLATES)).toBe(false);
    expect(isDurationAvailable(15, WORKOUT_TEMPLATES)).toBe(false);
    expect(isDurationAvailable(20, WORKOUT_TEMPLATES)).toBe(false);
  });
});

describe('isCategoryAvailable', () => {
  it('is true for blood-shunt at 5 minutes', () => {
    const bloodShunt = WORKOUT_CATEGORIES.find((category) => category.id === 'blood-shunt');
    expect(bloodShunt).toBeDefined();
    if (!bloodShunt) {
      return;
    }

    expect(isCategoryAvailable(bloodShunt, 5, WORKOUT_TEMPLATES)).toBe(true);
  });

  it('is true for localized-trap at 5 minutes', () => {
    const localizedTrap = WORKOUT_CATEGORIES.find(
      (category) => category.id === 'localized-trap'
    );
    expect(localizedTrap).toBeDefined();
    if (!localizedTrap) {
      return;
    }

    expect(isCategoryAvailable(localizedTrap, 5, WORKOUT_TEMPLATES)).toBe(true);
  });

  it('is false for categories without templates at the duration', () => {
    const engineRoom = WORKOUT_CATEGORIES.find((category) => category.id === 'engine-room');
    expect(engineRoom).toBeDefined();
    if (!engineRoom) {
      return;
    }

    expect(isCategoryAvailable(engineRoom, 5, WORKOUT_TEMPLATES)).toBe(false);
  });
});

describe('firstAvailableCategoryForDuration', () => {
  it('returns blood-shunt for 5 minutes', () => {
    expect(firstAvailableCategoryForDuration(WORKOUT_CATEGORIES, 5, WORKOUT_TEMPLATES)).toBe(
      'blood-shunt'
    );
  });

  it('returns null when no category has templates', () => {
    expect(firstAvailableCategoryForDuration(WORKOUT_CATEGORIES, 10, WORKOUT_TEMPLATES)).toBe(
      null
    );
  });
});
