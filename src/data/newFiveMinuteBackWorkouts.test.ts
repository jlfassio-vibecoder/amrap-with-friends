import { describe, expect, it } from 'vitest';
import { getExerciseInfo } from '@/data/exerciseLibrary';
import { WORKOUT_TEMPLATES, type IntensityTier } from '@/data/workoutTemplates';

const FIVE_MINUTE_IDS = [
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

const TEN_MINUTE_IDS = [
  'the-rip-tide',
  'backdraft',
  'aero-dorsal',
  'the-lever',
  'counter-strike',
  'the-yoke',
  'the-oarsman',
  'steady-traction',
  'the-rowers-pace',
  'iron-scapula',
  'the-truss',
  'spinal-lock',
] as const;

const FIFTEEN_MINUTE_IDS = [
  'arterial-pull',
  'dorsal-tow',
  'venous-return',
  'the-scapular-axis',
  'global-retraction',
  'the-posterior-triad',
  'the-rowers-engine',
  'steady-draft',
  'endurance-tow',
  'iron-scapula-grind',
  'dorsal-span',
  'the-suspended-yoke',
] as const;

const TWENTY_MINUTE_SPECS = [
  { id: 'the-long-tow', intensityTier: 2 },
  { id: 'dorsal-engine', intensityTier: 2 },
  { id: 'the-steady-rower', intensityTier: 2 },
  { id: 'scapular-shift', intensityTier: 4 },
  { id: 'the-cross-draft', intensityTier: 4 },
  { id: 'posterior-vanguard', intensityTier: 4 },
  { id: 'the-iron-yoke', intensityTier: 5 },
  { id: 'dorsal-barricade', intensityTier: 4 },
  { id: 'the-suspended-scapula', intensityTier: 4 },
] as const satisfies ReadonlyArray<{ id: string; intensityTier: IntensityTier }>;

const PERIODIZATION_INJECT_SPECS = [
  { id: 'flash-point', durationMinutes: 5, intensityTier: 4 },
  { id: 'tactical-down-regulate', durationMinutes: 5, intensityTier: 2 },
  { id: 'the-anvil', durationMinutes: 10, intensityTier: 4 },
  { id: 'active-sonar', durationMinutes: 10, intensityTier: 2 },
  { id: 'shock-front', durationMinutes: 15, intensityTier: 4 },
  { id: 'the-washout', durationMinutes: 15, intensityTier: 2 },
] as const satisfies ReadonlyArray<{
  id: string;
  durationMinutes: 5 | 10 | 15;
  intensityTier: IntensityTier;
}>;

function assertResolvableTemplates(ids: readonly string[], durationMinutes: 5 | 10 | 15): void {
  const allIds = WORKOUT_TEMPLATES.map((template) => template.id);
  expect(new Set(allIds).size).toBe(allIds.length);

  for (const id of ids) {
    const template = WORKOUT_TEMPLATES.find((entry) => entry.id === id);
    expect(template, id).toBeTruthy();
    expect(template!.durationMinutes).toBe(durationMinutes);
    expect(template!.intensityTier).toBe(3);
    for (const movement of template!.movements) {
      expect(getExerciseInfo(movement.name), `${id}:${movement.name}`).toBeTruthy();
    }
  }
}

describe('new 5-minute back workouts', () => {
  it('ships twelve unique I3 templates with resolvable movements', () => {
    assertResolvableTemplates(FIVE_MINUTE_IDS, 5);
  });
});

describe('new 10-minute back workouts', () => {
  it('ships twelve unique I3 templates with resolvable movements', () => {
    assertResolvableTemplates(TEN_MINUTE_IDS, 10);
  });
});

describe('new 15-minute back workouts', () => {
  it('ships twelve unique I3 templates with resolvable movements', () => {
    assertResolvableTemplates(FIFTEEN_MINUTE_IDS, 15);
  });
});

describe('new 20-minute back workouts', () => {
  it('ships nine unique templates with pinned intensity tiers and resolvable movements', () => {
    const allIds = WORKOUT_TEMPLATES.map((template) => template.id);
    expect(new Set(allIds).size).toBe(allIds.length);

    for (const { id, intensityTier } of TWENTY_MINUTE_SPECS) {
      const template = WORKOUT_TEMPLATES.find((entry) => entry.id === id);
      expect(template, id).toBeTruthy();
      expect(template!.durationMinutes).toBe(20);
      expect(template!.intensityTier).toBe(intensityTier);
      for (const movement of template!.movements) {
        expect(getExerciseInfo(movement.name), `${id}:${movement.name}`).toBeTruthy();
      }
    }
  });
});

describe('I2/I4 periodization injects', () => {
  it('ships six unique templates with pinned intensity tiers and resolvable movements', () => {
    const allIds = WORKOUT_TEMPLATES.map((template) => template.id);
    expect(new Set(allIds).size).toBe(allIds.length);

    for (const { id, durationMinutes, intensityTier } of PERIODIZATION_INJECT_SPECS) {
      const template = WORKOUT_TEMPLATES.find((entry) => entry.id === id);
      expect(template, id).toBeTruthy();
      expect(template!.durationMinutes).toBe(durationMinutes);
      expect(template!.intensityTier).toBe(intensityTier);
      for (const movement of template!.movements) {
        expect(getExerciseInfo(movement.name), `${id}:${movement.name}`).toBeTruthy();
      }
    }
  });
});
