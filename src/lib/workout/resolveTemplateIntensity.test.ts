import { describe, it, expect } from 'vitest';
import { WORKOUT_TEMPLATES } from '@/data/workoutTemplates';
import { CUSTOM_WORKOUT_INTENSITY_TIER } from './resolveTemplateIntensity';

const TIER_5_IDS = new Set(['the-trench', 'iron-will', 'the-shield', 'the-iron-yoke']);
// Intentional tier-1 templates (beginner / baseline) that differ from the category default.
const TIER_1_IDS = new Set(['first-contact']);
// Short-domain periodization injects that differ from the category default (I3).
const TIER_4_IDS = new Set(['flash-point', 'the-anvil', 'shock-front']);
const TIER_2_IDS = new Set(['tactical-down-regulate', 'active-sonar', 'the-washout']);

const CATEGORY_TIER: Record<string, number> = {
  'aerobic-matrix': 2,
  'blood-shunt': 3,
  'localized-trap': 3,
  'engine-room': 3,
  'midline-tension': 3,
  'four-point-cascade': 4,
  'armor-protocol': 4,
};

describe('library template intensity', () => {
  it('hardcodes intensity 1–5 on every template', () => {
    expect(WORKOUT_TEMPLATES).toHaveLength(203);
    for (const template of WORKOUT_TEMPLATES) {
      expect(template.intensityTier).toBeGreaterThanOrEqual(1);
      expect(template.intensityTier).toBeLessThanOrEqual(5);
    }
  });

  it('matches the category table and Tier 5 armor outliers', () => {
    for (const template of WORKOUT_TEMPLATES) {
      if (TIER_5_IDS.has(template.id)) {
        expect(template.intensityTier).toBe(5);
        continue;
      }
      if (TIER_4_IDS.has(template.id)) {
        expect(template.intensityTier).toBe(4);
        continue;
      }
      if (TIER_2_IDS.has(template.id)) {
        expect(template.intensityTier).toBe(2);
        continue;
      }
      if (TIER_1_IDS.has(template.id)) {
        expect(template.intensityTier).toBe(1);
        continue;
      }
      expect(template.category).not.toBeNull();
      expect(template.intensityTier).toBe(CATEGORY_TIER[template.category ?? '']);
    }
  });

  it('treats custom workouts as foundational (tier 2)', () => {
    expect(CUSTOM_WORKOUT_INTENSITY_TIER).toBe(2);
  });
});
