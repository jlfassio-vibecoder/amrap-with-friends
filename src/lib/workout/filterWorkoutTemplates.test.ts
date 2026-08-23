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

  it('returns 10 Blood Shunt templates at 10 minutes', () => {
    expect(
      filterWorkoutTemplates(WORKOUT_TEMPLATES, {
        durationMinutes: 10,
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

  it('returns 10 Engine Room templates at 5 minutes', () => {
    expect(
      filterWorkoutTemplates(WORKOUT_TEMPLATES, {
        durationMinutes: 5,
        category: 'engine-room',
      })
    ).toHaveLength(10);
  });

  it('returns 10 Midline Tension templates at 5 minutes', () => {
    expect(
      filterWorkoutTemplates(WORKOUT_TEMPLATES, {
        durationMinutes: 5,
        category: 'midline-tension',
      })
    ).toHaveLength(10);
  });

  it('returns empty for 15 and 20 minutes', () => {
    for (const duration of [15, 20] as TimeDomain[]) {
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
  it('is true for 5 and 10 minutes', () => {
    expect(isDurationAvailable(5, WORKOUT_TEMPLATES)).toBe(true);
    expect(isDurationAvailable(10, WORKOUT_TEMPLATES)).toBe(true);
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
    expect(isCategoryAvailable(bloodShunt, 10, WORKOUT_TEMPLATES)).toBe(true);
  });

  it('is false for non-blood-shunt categories at 10 minutes', () => {
    for (const categoryId of ['localized-trap', 'engine-room', 'midline-tension'] as const) {
      const category = WORKOUT_CATEGORIES.find((entry) => entry.id === categoryId);
      expect(category).toBeDefined();
      if (!category) {
        return;
      }

      expect(isCategoryAvailable(category, 10, WORKOUT_TEMPLATES)).toBe(false);
    }
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

  it('is true for engine-room at 5 minutes', () => {
    const engineRoom = WORKOUT_CATEGORIES.find((category) => category.id === 'engine-room');
    expect(engineRoom).toBeDefined();
    if (!engineRoom) {
      return;
    }

    expect(isCategoryAvailable(engineRoom, 5, WORKOUT_TEMPLATES)).toBe(true);
  });

  it('is true for midline-tension at 5 minutes', () => {
    const midlineTension = WORKOUT_CATEGORIES.find(
      (category) => category.id === 'midline-tension'
    );
    expect(midlineTension).toBeDefined();
    if (!midlineTension) {
      return;
    }

    expect(isCategoryAvailable(midlineTension, 5, WORKOUT_TEMPLATES)).toBe(true);
  });

  it('reports every category as available at 5 minutes', () => {
    for (const category of WORKOUT_CATEGORIES) {
      expect(isCategoryAvailable(category, 5, WORKOUT_TEMPLATES)).toBe(true);
    }
  });
});

describe('firstAvailableCategoryForDuration', () => {
  it('returns blood-shunt for 5 minutes', () => {
    expect(firstAvailableCategoryForDuration(WORKOUT_CATEGORIES, 5, WORKOUT_TEMPLATES)).toBe(
      'blood-shunt'
    );
  });

  it('returns blood-shunt for 10 minutes', () => {
    expect(firstAvailableCategoryForDuration(WORKOUT_CATEGORIES, 10, WORKOUT_TEMPLATES)).toBe(
      'blood-shunt'
    );
  });

  it('returns null for 15 minutes when no category has templates', () => {
    expect(firstAvailableCategoryForDuration(WORKOUT_CATEGORIES, 15, WORKOUT_TEMPLATES)).toBe(
      null
    );
  });
});
