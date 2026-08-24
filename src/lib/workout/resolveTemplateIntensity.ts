import type {
  IntensityTier,
  WorkoutCategory,
  WorkoutTemplate,
} from '@/data/workoutTemplates';

/** Custom (no template) and historical NULL intensity — volume only, not lethality 3+/4+. */
export const CUSTOM_WORKOUT_INTENSITY_TIER: IntensityTier = 2;

const CATEGORY_DEFAULT_INTENSITY: Record<WorkoutCategory, IntensityTier> = {
  'aerobic-matrix': 2,
  'blood-shunt': 3,
  'localized-trap': 3,
  'engine-room': 3,
  'midline-tension': 3,
  'four-point-cascade': 4,
  'armor-protocol': 4,
};

export function resolveTemplateIntensity(
  template: Pick<WorkoutTemplate, 'category' | 'intensityTier'>
): IntensityTier {
  if (template.intensityTier !== undefined) {
    return template.intensityTier;
  }
  if (template.category === null) {
    return 2;
  }
  return CATEGORY_DEFAULT_INTENSITY[template.category];
}
