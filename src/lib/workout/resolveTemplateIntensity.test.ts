import { describe, it, expect } from 'vitest';
import { WORKOUT_TEMPLATES } from '@/data/workoutTemplates';
import {
  CUSTOM_WORKOUT_INTENSITY_TIER,
  resolveTemplateIntensity,
} from './resolveTemplateIntensity';

describe('resolveTemplateIntensity', () => {
  it('assigns every library template an intensity in 1–5', () => {
    for (const template of WORKOUT_TEMPLATES) {
      const tier = resolveTemplateIntensity(template);
      expect(tier).toBeGreaterThanOrEqual(1);
      expect(tier).toBeLessThanOrEqual(5);
    }
  });

  it('applies category defaults', () => {
    expect(
      resolveTemplateIntensity({ category: 'aerobic-matrix' })
    ).toBe(2);
    expect(resolveTemplateIntensity({ category: 'blood-shunt' })).toBe(3);
    expect(resolveTemplateIntensity({ category: 'localized-trap' })).toBe(3);
    expect(resolveTemplateIntensity({ category: 'engine-room' })).toBe(3);
    expect(resolveTemplateIntensity({ category: 'midline-tension' })).toBe(3);
    expect(
      resolveTemplateIntensity({ category: 'four-point-cascade' })
    ).toBe(4);
    expect(resolveTemplateIntensity({ category: 'armor-protocol' })).toBe(4);
    expect(resolveTemplateIntensity({ category: null })).toBe(2);
  });

  it('honors explicit intensityTier overrides (Tier 5 armor outliers)', () => {
    expect(
      resolveTemplateIntensity({
        category: 'armor-protocol',
        intensityTier: 5,
      })
    ).toBe(5);

    const trench = WORKOUT_TEMPLATES.find((t) => t.id === 'the-trench');
    const ironWill = WORKOUT_TEMPLATES.find((t) => t.id === 'iron-will');
    const shield = WORKOUT_TEMPLATES.find((t) => t.id === 'the-shield');
    expect(trench && resolveTemplateIntensity(trench)).toBe(5);
    expect(ironWill && resolveTemplateIntensity(ironWill)).toBe(5);
    expect(shield && resolveTemplateIntensity(shield)).toBe(5);
  });

  it('treats custom workouts as foundational (tier 2)', () => {
    expect(CUSTOM_WORKOUT_INTENSITY_TIER).toBe(2);
  });
});
