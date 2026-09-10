import type { WorkoutCategory } from '@/data/workoutTemplates';

export type MovementPattern =
  'upper-push' | 'upper-pull' | 'lower-body' | 'core' | 'full-body-conditioning';

export const ALL_MOVEMENT_PATTERNS: readonly MovementPattern[] = [
  'upper-push',
  'upper-pull',
  'lower-body',
  'core',
  'full-body-conditioning',
] as const;

export const MOVEMENT_PATTERN_LABELS: Record<MovementPattern, string> = {
  'upper-push': 'Upper body push',
  'upper-pull': 'Upper body pull',
  'lower-body': 'Lower body',
  core: 'Core',
  'full-body-conditioning': 'Full body conditioning',
};

/**
 * Fallback when an exercise is unknown or untagged. Localized Trap has no default —
 * those templates must resolve via exercise tags.
 */
export const CATEGORY_DEFAULT_PATTERNS: Record<WorkoutCategory, MovementPattern[]> = {
  'blood-shunt': ['full-body-conditioning'],
  'localized-trap': [],
  'engine-room': ['full-body-conditioning'],
  'midline-tension': ['core'],
  'aerobic-matrix': ['full-body-conditioning'],
  'four-point-cascade': ['full-body-conditioning'],
  'armor-protocol': ['full-body-conditioning'],
};

const MOVEMENT_PATTERN_SET = new Set<string>(ALL_MOVEMENT_PATTERNS);

export function movementPatternLabel(id: MovementPattern): string {
  return MOVEMENT_PATTERN_LABELS[id];
}

export function isMovementPattern(value: string): value is MovementPattern {
  return MOVEMENT_PATTERN_SET.has(value);
}
