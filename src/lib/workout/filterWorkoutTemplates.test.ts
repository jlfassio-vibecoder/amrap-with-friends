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
  categoriesForDuration,
  categoryDisplayForDuration,
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

  it('returns 10 Blood Shunt templates at 15 minutes', () => {
    expect(
      filterWorkoutTemplates(WORKOUT_TEMPLATES, {
        durationMinutes: 15,
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

  it('returns empty for 20 minutes', () => {
    expect(
      filterWorkoutTemplates(WORKOUT_TEMPLATES, {
        durationMinutes: 20,
        category: 'blood-shunt',
      })
    ).toEqual([]);
  });

  it('returns 10 Aerobic Matrix templates at 20 minutes', () => {
    expect(
      filterWorkoutTemplates(WORKOUT_TEMPLATES, {
        durationMinutes: 20,
        category: 'aerobic-matrix',
      })
    ).toHaveLength(10);
  });
});

describe('WORKOUT_TEMPLATES data integrity', () => {
  it('uses unique ids across all templates', () => {
    const ids = WORKOUT_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps distinct ids for The Metronome across durations', () => {
    expect(WORKOUT_TEMPLATES.filter((template) => template.name === 'The Metronome')).toHaveLength(
      2
    );
    expect(WORKOUT_TEMPLATES.find((template) => template.id === 'the-metronome')?.durationMinutes).toBe(
      5
    );
    expect(
      WORKOUT_TEMPLATES.find((template) => template.id === 'the-metronome-endurance')?.durationMinutes
    ).toBe(15);
  });
});

describe('isDurationAvailable', () => {
  it('is true for 5, 10, 15, and 20 minutes', () => {
    expect(isDurationAvailable(5, WORKOUT_TEMPLATES)).toBe(true);
    expect(isDurationAvailable(10, WORKOUT_TEMPLATES)).toBe(true);
    expect(isDurationAvailable(15, WORKOUT_TEMPLATES)).toBe(true);
    expect(isDurationAvailable(20, WORKOUT_TEMPLATES)).toBe(true);
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
    expect(isCategoryAvailable(bloodShunt, 15, WORKOUT_TEMPLATES)).toBe(true);
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

  it('is true for aerobic-matrix at 20 minutes', () => {
    const aerobicMatrix = WORKOUT_CATEGORIES.find(
      (category) => category.id === 'aerobic-matrix'
    );
    expect(aerobicMatrix).toBeDefined();
    if (!aerobicMatrix) {
      return;
    }

    expect(isCategoryAvailable(aerobicMatrix, 20, WORKOUT_TEMPLATES)).toBe(true);
  });

  it('is false for aerobic-matrix at 5, 10, and 15 minutes', () => {
    const aerobicMatrix = WORKOUT_CATEGORIES.find(
      (category) => category.id === 'aerobic-matrix'
    );
    expect(aerobicMatrix).toBeDefined();
    if (!aerobicMatrix) {
      return;
    }

    expect(isCategoryAvailable(aerobicMatrix, 5, WORKOUT_TEMPLATES)).toBe(false);
    expect(isCategoryAvailable(aerobicMatrix, 10, WORKOUT_TEMPLATES)).toBe(false);
    expect(isCategoryAvailable(aerobicMatrix, 15, WORKOUT_TEMPLATES)).toBe(false);
  });

  it('is false for legacy categories at 20 minutes', () => {
    for (const categoryId of [
      'blood-shunt',
      'localized-trap',
      'engine-room',
      'midline-tension',
    ] as const) {
      const category = WORKOUT_CATEGORIES.find((entry) => entry.id === categoryId);
      expect(category).toBeDefined();
      if (!category) {
        return;
      }

      expect(isCategoryAvailable(category, 20, WORKOUT_TEMPLATES)).toBe(false);
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

  it('reports every 5-minute category as available at 5 minutes', () => {
    for (const category of WORKOUT_CATEGORIES) {
      if (!category.availableForDurations.includes(5)) {
        continue;
      }

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

  it('returns blood-shunt for 15 minutes', () => {
    expect(firstAvailableCategoryForDuration(WORKOUT_CATEGORIES, 15, WORKOUT_TEMPLATES)).toBe(
      'blood-shunt'
    );
  });

  it('returns aerobic-matrix for 20 minutes', () => {
    expect(firstAvailableCategoryForDuration(WORKOUT_CATEGORIES, 20, WORKOUT_TEMPLATES)).toBe(
      'aerobic-matrix'
    );
  });
});

describe('categoriesForDuration', () => {
  it('excludes aerobic-matrix at 5, 10, and 15 minutes', () => {
    for (const duration of [5, 10, 15] as TimeDomain[]) {
      const ids = categoriesForDuration(WORKOUT_CATEGORIES, duration).map(
        (category) => category.id
      );
      expect(ids).not.toContain('aerobic-matrix');
    }
  });

  it('includes only aerobic-matrix at 20 minutes', () => {
    expect(categoriesForDuration(WORKOUT_CATEGORIES, 20).map((category) => category.id)).toEqual([
      'aerobic-matrix',
    ]);
  });

  it('includes blood-shunt at 5, 10, and 15 minutes', () => {
    for (const duration of [5, 10, 15] as TimeDomain[]) {
      const ids = categoriesForDuration(WORKOUT_CATEGORIES, duration).map(
        (category) => category.id
      );
      expect(ids).toContain('blood-shunt');
    }
  });
});

describe('categoryDisplayForDuration', () => {
  it('returns base label and description for blood-shunt at 5 minutes', () => {
    const bloodShunt = WORKOUT_CATEGORIES.find((category) => category.id === 'blood-shunt');
    expect(bloodShunt).toBeDefined();
    if (!bloodShunt) {
      return;
    }

    expect(categoryDisplayForDuration(bloodShunt, 5)).toEqual({
      label: 'Blood Shunt',
      description: bloodShunt.description,
    });
  });

  it('returns override label and description for blood-shunt at 10 minutes', () => {
    const bloodShunt = WORKOUT_CATEGORIES.find((category) => category.id === 'blood-shunt');
    expect(bloodShunt).toBeDefined();
    if (!bloodShunt) {
      return;
    }

    expect(categoryDisplayForDuration(bloodShunt, 10)).toEqual({
      label: 'Aerobic Blood Shunt',
      description:
        'The format survives the time jump by shifting from couplets to triplets — a low-interference bridge movement keeps the heart rate redlined while blood physically travels from the upper to the lower extremities.',
    });
  });

  it('returns base label and description for categories without overrides', () => {
    const localizedTrap = WORKOUT_CATEGORIES.find(
      (category) => category.id === 'localized-trap'
    );
    expect(localizedTrap).toBeDefined();
    if (!localizedTrap) {
      return;
    }

    expect(categoryDisplayForDuration(localizedTrap, 5)).toEqual({
      label: 'Localized Trap',
      description: localizedTrap.description,
    });
  });
});
