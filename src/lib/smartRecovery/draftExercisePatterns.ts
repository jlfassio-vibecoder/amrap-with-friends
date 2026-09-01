/**
 * Phase 0 draft — merge into ExerciseInfo.primaryPatterns in Phase 1.
 *
 * Tagging rubric (primary mover under fatigue):
 * - upper-push: horizontal/vertical push (push-ups, dips, pike)
 * - upper-pull: posterior chain / pull (supermans, good mornings)
 * - lower-body: squat, lunge, jump loading quads/glutes
 * - core: anti-extension, rotation, hollow, leg raise, plank
 * - full-body-conditioning: burpees, jacks, shuffles, multi-segment cardio
 *
 * Multi-pattern entries are allowed when two patterns share load equally.
 */
import { EXERCISE_LIBRARY } from '@/data/exerciseLibrary';
import type { MovementPattern } from '@/lib/smartRecovery/movementPatterns';

export const DRAFT_EXERCISE_PATTERNS: Record<string, MovementPattern[]> = {
  burpees: ['full-body-conditioning'],
  'air-squat': ['lower-body'],
  'alternating-lunges': ['lower-body'],
  surrenders: ['lower-body'],
  'glute-bridges': ['lower-body'],
  'standard-push-ups': ['upper-push'],
  'wide-grip-push-ups': ['upper-push'],
  'hand-release-push-ups': ['upper-push'],
  'diamond-push-ups': ['upper-push'],
  'pike-push-ups': ['upper-push'],
  'dive-bomber-push-ups': ['upper-push', 'core'],
  't-push-ups': ['upper-push', 'core'],
  'plank-shoulder-taps': ['upper-push', 'core'],
  'commando-planks': ['core', 'upper-push'],
  'plank-jacks': ['full-body-conditioning', 'core'],
  'jump-squats': ['lower-body', 'full-body-conditioning'],
  'jumping-lunges': ['lower-body'],
  'skater-jumps': ['lower-body', 'full-body-conditioning'],
  'tuck-jumps': ['lower-body', 'full-body-conditioning'],
  'broad-jumps': ['lower-body', 'full-body-conditioning'],
  'bottom-squat-hold': ['lower-body'],
  'sphinx-push-ups': ['upper-push'],
  'floor-dips': ['upper-push'],
  'hollow-hold': ['core'],
  'reverse-lunges': ['lower-body'],
  'single-leg-glute-bridges': ['lower-body'],
  'standard-glute-bridges': ['lower-body'],
  'wide-push-ups': ['upper-push'],
  'side-plank-dips': ['core'],
  'pogo-jumps': ['lower-body', 'full-body-conditioning'],
  'fast-calf-raises': ['lower-body'],
  sprawls: ['full-body-conditioning'],
  'combat-sprawls': ['full-body-conditioning'],
  'down-ups': ['full-body-conditioning'],
  'half-burpees': ['full-body-conditioning'],
  'mountain-climbers': ['full-body-conditioning', 'core'],
  'cross-body-mountain-climbers': ['full-body-conditioning', 'core'],
  'high-knees': ['full-body-conditioning'],
  'butt-kicks': ['full-body-conditioning'],
  'jumping-jacks': ['full-body-conditioning'],
  'lateral-line-hops': ['lower-body', 'full-body-conditioning'],
  'double-tap-jumps': ['lower-body', 'full-body-conditioning'],
  'v-ups': ['core'],
  'strict-sit-ups': ['core'],
  'leg-raises': ['core'],
  'russian-twists': ['core'],
  'bicycle-crunches': ['core'],
  'plank-knee-to-elbows': ['core'],
  'dead-bugs': ['core'],
  'flutter-kicks': ['core'],
  'superman-raises': ['upper-pull'],
  'alternating-bird-dogs': ['core'],
  'bear-crawl-hover': ['core', 'full-body-conditioning'],
  'high-plank-hold': ['core'],
  'hollow-rocks': ['core'],
  'plank-hold': ['core'],
  'plank-reaches': ['core'],
  'side-plank-hold': ['core'],
  'v-sit-hold': ['core'],
  'butterfly-sit-ups': ['core'],
  'cross-body-climbers': ['full-body-conditioning', 'core'],
  'bodyweight-good-mornings': ['upper-pull'],
  'glute-bridge-hold': ['lower-body'],
  'glute-bridge-walkouts': ['lower-body'],
  'reverse-snow-angels': ['upper-pull'],
  'superman-hold': ['upper-pull'],
  'superman-pull-downs': ['upper-pull'],
  supermans: ['upper-pull'],
  'bear-crawl-to-broad-jumps': ['full-body-conditioning'],
  'fast-air-squats': ['lower-body'],
  'push-ups': ['upper-push'],
  'strict-reverse-lunges': ['lower-body'],
  'walking-lunges': ['lower-body'],
};

export function assertDraftCoversExerciseLibrary(): void {
  const missing = EXERCISE_LIBRARY.map((entry) => entry.id).filter(
    (id) => !(id in DRAFT_EXERCISE_PATTERNS)
  );
  if (missing.length > 0) {
    throw new Error(`DRAFT_EXERCISE_PATTERNS missing exercise ids: ${missing.join(', ')}`);
  }
}

export function draftPatternsForExerciseId(exerciseId: string): MovementPattern[] | undefined {
  return DRAFT_EXERCISE_PATTERNS[exerciseId];
}
