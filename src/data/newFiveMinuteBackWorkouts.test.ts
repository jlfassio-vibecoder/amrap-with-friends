import { describe, expect, it } from 'vitest';
import { getExerciseInfo } from '@/data/exerciseLibrary';
import { WORKOUT_TEMPLATES } from '@/data/workoutTemplates';

const NEW_IDS = [
  'the-ripcord',
  'reverse-flow',
  'dorsal-spike',
  'dorsal-demise',
  'the-scapular-trap',
  'rhomboid-ruin',
  'posterior-turbine',
  'the-draft',
  'aft-engine',
  'the-arch',
  'the-bowstring',
  'spinal-coil',
] as const;

describe('new 5-minute back workouts', () => {
  it('ships twelve unique I3 templates with resolvable movements', () => {
    const allIds = WORKOUT_TEMPLATES.map((template) => template.id);
    expect(new Set(allIds).size).toBe(allIds.length);

    for (const id of NEW_IDS) {
      const template = WORKOUT_TEMPLATES.find((entry) => entry.id === id);
      expect(template, id).toBeTruthy();
      expect(template!.durationMinutes).toBe(5);
      expect(template!.intensityTier).toBe(3);
      for (const movement of template!.movements) {
        expect(getExerciseInfo(movement.name), `${id}:${movement.name}`).toBeTruthy();
      }
    }
  });
});
