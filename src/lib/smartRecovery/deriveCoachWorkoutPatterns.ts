import { getExerciseInfo } from '@/data/exerciseLibrary';
import type { PublishedCoachWorkout } from '@/lib/api/coachWod';
import type { MovementPattern } from '@/lib/smartRecovery/movementPatterns';

const TOP_PATTERN_COUNT = 2;

export function coachWorkoutLockId(workoutId: string): string {
  return `coach:${workoutId}`;
}

function topPatternsByFrequency(counts: Map<MovementPattern, number>): MovementPattern[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_PATTERN_COUNT)
    .map(([pattern]) => pattern);
}

function addPatternCounts(counts: Map<MovementPattern, number>, patterns: MovementPattern[]): void {
  for (const pattern of patterns) {
    counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
  }
}

function patternsForMovementName(name: string): MovementPattern[] {
  return getExerciseInfo(name)?.primaryPatterns ?? [];
}

export function deriveCoachWorkoutPrimaryPatterns(
  workout: PublishedCoachWorkout
): MovementPattern[] {
  const counts = new Map<MovementPattern, number>();

  for (const movement of workout.movements) {
    let patterns = patternsForMovementName(movement.name);
    if (patterns.length === 0 && movement.exercise) {
      patterns = patternsForMovementName(movement.exercise.name);
    }
    addPatternCounts(counts, patterns);
  }

  return topPatternsByFrequency(counts);
}

export function buildCoachWorkoutPatternIndex(
  workouts: PublishedCoachWorkout[]
): Map<string, MovementPattern[]> {
  return new Map(
    workouts.map((workout) => [
      coachWorkoutLockId(workout.id),
      deriveCoachWorkoutPrimaryPatterns(workout),
    ])
  );
}
