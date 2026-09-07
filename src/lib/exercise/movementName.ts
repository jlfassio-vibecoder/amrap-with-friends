import { EXERCISE_LIBRARY, type ExerciseInfo } from '@/data/exerciseLibrary';

/**
 * Match a workout movement name to its library exercise.
 *
 * Workout templates qualify movements the library does not — "Reverse Lunges
 * (Total)", "Skater Jumps (Total)" — so a trailing parenthetical is dropped
 * before matching. This normalisation lived only in the SEO stats module; it is
 * here now because two copies of it would eventually disagree about which
 * movement a workout is referring to.
 */
export function normalizeMovementName(name: string): string {
  return name
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim()
    .toLowerCase();
}

const BY_NORMALIZED_NAME = new Map(
  EXERCISE_LIBRARY.map((entry) => [normalizeMovementName(entry.name), entry])
);

export function exerciseForMovementName(name: string): ExerciseInfo | null {
  return BY_NORMALIZED_NAME.get(normalizeMovementName(name)) ?? null;
}
