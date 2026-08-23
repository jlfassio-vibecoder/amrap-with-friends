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

  it('returns 10 Localized Trap templates at 10 minutes', () => {
    expect(
      filterWorkoutTemplates(WORKOUT_TEMPLATES, {
        durationMinutes: 10,
        category: 'localized-trap',
      })
    ).toHaveLength(10);
  });

  it('returns 10 Localized Trap templates at 15 minutes', () => {
    expect(
      filterWorkoutTemplates(WORKOUT_TEMPLATES, {
        durationMinutes: 15,
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

  it('returns 10 Engine Room templates at 10 minutes', () => {
    expect(
      filterWorkoutTemplates(WORKOUT_TEMPLATES, {
        durationMinutes: 10,
        category: 'engine-room',
      })
    ).toHaveLength(10);
  });

  it('returns 10 Engine Room templates at 15 minutes', () => {
    expect(
      filterWorkoutTemplates(WORKOUT_TEMPLATES, {
        durationMinutes: 15,
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

  it('returns 10 Midline Tension templates at 10 minutes', () => {
    expect(
      filterWorkoutTemplates(WORKOUT_TEMPLATES, {
        durationMinutes: 10,
        category: 'midline-tension',
      })
    ).toHaveLength(10);
  });

  it('returns 10 Midline Tension templates at 15 minutes', () => {
    expect(
      filterWorkoutTemplates(WORKOUT_TEMPLATES, {
        durationMinutes: 15,
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

  it('returns 10 4-Point Cascade templates at 20 minutes', () => {
    expect(
      filterWorkoutTemplates(WORKOUT_TEMPLATES, {
        durationMinutes: 20,
        category: 'four-point-cascade',
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

  it('keeps distinct ids for The See-Saw across durations', () => {
    expect(WORKOUT_TEMPLATES.filter((template) => template.name === 'The See-Saw')).toHaveLength(
      2
    );
    expect(WORKOUT_TEMPLATES.find((template) => template.id === 'the-see-saw')?.durationMinutes).toBe(
      5
    );
    expect(
      WORKOUT_TEMPLATES.find((template) => template.id === 'the-see-saw-push-pull')?.durationMinutes
    ).toBe(10);
  });

  it('keeps distinct ids for The Fulcrum across durations', () => {
    expect(WORKOUT_TEMPLATES.filter((template) => template.name === 'The Fulcrum')).toHaveLength(
      2
    );
    expect(WORKOUT_TEMPLATES.find((template) => template.id === 'the-fulcrum')?.durationMinutes).toBe(
      10
    );
    expect(
      WORKOUT_TEMPLATES.find((template) => template.id === 'the-fulcrum-systemic-shift')
        ?.durationMinutes
    ).toBe(15);
  });

  it('keeps distinct ids for The Long Stride across durations', () => {
    expect(WORKOUT_TEMPLATES.filter((template) => template.name === 'The Long Stride')).toHaveLength(
      2
    );
    expect(
      WORKOUT_TEMPLATES.find((template) => template.id === 'the-long-stride')?.durationMinutes
    ).toBe(10);
    expect(
      WORKOUT_TEMPLATES.find((template) => template.id === 'the-long-stride-endurance')
        ?.durationMinutes
    ).toBe(15);
  });

  it('keeps distinct ids for The Cruiser across durations', () => {
    expect(WORKOUT_TEMPLATES.filter((template) => template.name === 'The Cruiser')).toHaveLength(2);
    expect(WORKOUT_TEMPLATES.find((template) => template.id === 'the-cruiser')?.durationMinutes).toBe(
      10
    );
    expect(
      WORKOUT_TEMPLATES.find((template) => template.id === 'the-cruiser-endurance')?.durationMinutes
    ).toBe(15);
  });

  it('keeps distinct ids for The Piston across durations', () => {
    expect(WORKOUT_TEMPLATES.filter((template) => template.name === 'The Piston')).toHaveLength(2);
    expect(WORKOUT_TEMPLATES.find((template) => template.id === 'the-piston')?.durationMinutes).toBe(
      5
    );
    expect(
      WORKOUT_TEMPLATES.find((template) => template.id === 'the-piston-cascade')?.durationMinutes
    ).toBe(20);
  });

  it('keeps distinct ids for The Sentinel across 20-minute categories', () => {
    expect(WORKOUT_TEMPLATES.filter((template) => template.name === 'The Sentinel')).toHaveLength(
      2
    );
    expect(
      WORKOUT_TEMPLATES.find((template) => template.id === 'the-sentinel')?.category
    ).toBe('aerobic-matrix');
    expect(
      WORKOUT_TEMPLATES.find((template) => template.id === 'the-sentinel-cascade')?.category
    ).toBe('four-point-cascade');
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

  it('is true for midline-tension at 10 minutes', () => {
    const midlineTension = WORKOUT_CATEGORIES.find(
      (category) => category.id === 'midline-tension'
    );
    expect(midlineTension).toBeDefined();
    if (!midlineTension) {
      return;
    }

    expect(isCategoryAvailable(midlineTension, 10, WORKOUT_TEMPLATES)).toBe(true);
  });

  it('is true for midline-tension at 15 minutes', () => {
    const midlineTension = WORKOUT_CATEGORIES.find(
      (category) => category.id === 'midline-tension'
    );
    expect(midlineTension).toBeDefined();
    if (!midlineTension) {
      return;
    }

    expect(isCategoryAvailable(midlineTension, 15, WORKOUT_TEMPLATES)).toBe(true);
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

  it('is true for four-point-cascade at 20 minutes', () => {
    const fourPointCascade = WORKOUT_CATEGORIES.find(
      (category) => category.id === 'four-point-cascade'
    );
    expect(fourPointCascade).toBeDefined();
    if (!fourPointCascade) {
      return;
    }

    expect(isCategoryAvailable(fourPointCascade, 20, WORKOUT_TEMPLATES)).toBe(true);
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

  it('is false for four-point-cascade at 5, 10, and 15 minutes', () => {
    const fourPointCascade = WORKOUT_CATEGORIES.find(
      (category) => category.id === 'four-point-cascade'
    );
    expect(fourPointCascade).toBeDefined();
    if (!fourPointCascade) {
      return;
    }

    expect(isCategoryAvailable(fourPointCascade, 5, WORKOUT_TEMPLATES)).toBe(false);
    expect(isCategoryAvailable(fourPointCascade, 10, WORKOUT_TEMPLATES)).toBe(false);
    expect(isCategoryAvailable(fourPointCascade, 15, WORKOUT_TEMPLATES)).toBe(false);
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

  it('is true for localized-trap at 10 minutes', () => {
    const localizedTrap = WORKOUT_CATEGORIES.find(
      (category) => category.id === 'localized-trap'
    );
    expect(localizedTrap).toBeDefined();
    if (!localizedTrap) {
      return;
    }

    expect(isCategoryAvailable(localizedTrap, 10, WORKOUT_TEMPLATES)).toBe(true);
  });

  it('is true for localized-trap at 15 minutes', () => {
    const localizedTrap = WORKOUT_CATEGORIES.find(
      (category) => category.id === 'localized-trap'
    );
    expect(localizedTrap).toBeDefined();
    if (!localizedTrap) {
      return;
    }

    expect(isCategoryAvailable(localizedTrap, 15, WORKOUT_TEMPLATES)).toBe(true);
  });

  it('is true for engine-room at 5 minutes', () => {
    const engineRoom = WORKOUT_CATEGORIES.find((category) => category.id === 'engine-room');
    expect(engineRoom).toBeDefined();
    if (!engineRoom) {
      return;
    }

    expect(isCategoryAvailable(engineRoom, 5, WORKOUT_TEMPLATES)).toBe(true);
  });

  it('is true for engine-room at 10 minutes', () => {
    const engineRoom = WORKOUT_CATEGORIES.find((category) => category.id === 'engine-room');
    expect(engineRoom).toBeDefined();
    if (!engineRoom) {
      return;
    }

    expect(isCategoryAvailable(engineRoom, 10, WORKOUT_TEMPLATES)).toBe(true);
  });

  it('is true for engine-room at 15 minutes', () => {
    const engineRoom = WORKOUT_CATEGORIES.find((category) => category.id === 'engine-room');
    expect(engineRoom).toBeDefined();
    if (!engineRoom) {
      return;
    }

    expect(isCategoryAvailable(engineRoom, 15, WORKOUT_TEMPLATES)).toBe(true);
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
      expect(ids).not.toContain('four-point-cascade');
    }
  });

  it('includes aerobic-matrix and four-point-cascade at 20 minutes', () => {
    expect(categoriesForDuration(WORKOUT_CATEGORIES, 20).map((category) => category.id)).toEqual([
      'aerobic-matrix',
      'four-point-cascade',
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

  it('includes localized-trap at 10 minutes', () => {
    const ids = categoriesForDuration(WORKOUT_CATEGORIES, 10).map((category) => category.id);
    expect(ids).toContain('localized-trap');
  });

  it('includes localized-trap at 15 minutes', () => {
    const ids = categoriesForDuration(WORKOUT_CATEGORIES, 15).map((category) => category.id);
    expect(ids).toContain('localized-trap');
  });

  it('includes engine-room at 10 minutes', () => {
    const ids = categoriesForDuration(WORKOUT_CATEGORIES, 10).map((category) => category.id);
    expect(ids).toContain('engine-room');
  });

  it('includes engine-room at 15 minutes', () => {
    const ids = categoriesForDuration(WORKOUT_CATEGORIES, 15).map((category) => category.id);
    expect(ids).toContain('engine-room');
  });

  it('includes midline-tension at 10 minutes', () => {
    const ids = categoriesForDuration(WORKOUT_CATEGORIES, 10).map((category) => category.id);
    expect(ids).toContain('midline-tension');
  });

  it('includes midline-tension at 15 minutes', () => {
    const ids = categoriesForDuration(WORKOUT_CATEGORIES, 15).map((category) => category.id);
    expect(ids).toContain('midline-tension');
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

  it('returns override label and description for localized-trap at 10 minutes', () => {
    const localizedTrap = WORKOUT_CATEGORIES.find(
      (category) => category.id === 'localized-trap'
    );
    expect(localizedTrap).toBeDefined();
    if (!localizedTrap) {
      return;
    }

    expect(categoryDisplayForDuration(localizedTrap, 10)).toEqual({
      label: 'Push-Pull',
      description:
        'Anterior Chain versus Posterior Chain — without equipment, true pulling is a hinge-and-spinal-erector puzzle. Pair aggressive chest, shoulder, and quad pushing with heavy glute, hamstring, and posterior tension for a relentless 10-minute equilibrium that protects the joints while keeping the heart rate pinned.',
    });
  });

  it('returns override label and description for localized-trap at 15 minutes', () => {
    const localizedTrap = WORKOUT_CATEGORIES.find(
      (category) => category.id === 'localized-trap'
    );
    expect(localizedTrap).toBeDefined();
    if (!localizedTrap) {
      return;
    }

    expect(categoryDisplayForDuration(localizedTrap, 15)).toEqual({
      label: 'Systemic Shift',
      description:
        'Strict triplets hit upper body, lower body, and midline sequentially so no single muscle group fails completely — systemic fatigue and the central nervous system strain of constantly shifting load become the ultimate crucible.',
    });
  });

  it('returns override label and description for engine-room at 10 minutes', () => {
    const engineRoom = WORKOUT_CATEGORIES.find((category) => category.id === 'engine-room');
    expect(engineRoom).toBeDefined();
    if (!engineRoom) {
      return;
    }

    expect(categoryDisplayForDuration(engineRoom, 10)).toEqual({
      label: 'Sustained Engine',
      description:
        'Gravity and impact are the enemy at 10 minutes — bounce for 600 seconds and your Achilles fail before your lungs. Sustained Engine swaps joint-destroying plyometrics for sweeping, rhythmic compound work to keep the heart rate redlined safely.',
    });
  });

  it('returns override label and description for engine-room at 15 minutes', () => {
    const engineRoom = WORKOUT_CATEGORIES.find((category) => category.id === 'engine-room');
    expect(engineRoom).toBeDefined();
    if (!engineRoom) {
      return;
    }

    expect(categoryDisplayForDuration(engineRoom, 15)).toEqual({
      label: 'Sustained Engine',
      description:
        'Gravity and repetitive impact are the enemies at 15 minutes — pure plyometric bouncing will snap Achilles tendons before lungs fail. Sustained Engine uses sweeping, rhythmic compound triplets that demand heavy oxygen intake while protecting the joints.',
    });
  });

  it('returns override label and description for midline-tension at 10 minutes', () => {
    const midlineTension = WORKOUT_CATEGORIES.find(
      (category) => category.id === 'midline-tension'
    );
    expect(midlineTension).toBeDefined();
    if (!midlineTension) {
      return;
    }

    expect(categoryDisplayForDuration(midlineTension, 10)).toEqual({
      label: 'Structural Grind',
      description:
        'Continuous spinal flexion for 10 minutes is a recipe for disaster. Structural Grind pairs rigid isometrics and slow anti-rotation with steady lower-body engine work so the abdominal wall stabilizes the spine under shifting loads and protects the lower back.',
    });
  });

  it('returns override label and description for midline-tension at 15 minutes', () => {
    const midlineTension = WORKOUT_CATEGORIES.find(
      (category) => category.id === 'midline-tension'
    );
    expect(midlineTension).toBeDefined();
    if (!midlineTension) {
      return;
    }

    expect(categoryDisplayForDuration(midlineTension, 15)).toEqual({
      label: 'Structural Grind',
      description:
        'Continuous spinal flexion for 15 minutes is a recipe for disaster. Structural Grind pairs timed isometrics, slow anti-rotation, and posterior chain work with steady lower-body engine movements so the abdominal wall stabilizes the spine under shifting loads for the full core crucible.',
    });
  });
});
