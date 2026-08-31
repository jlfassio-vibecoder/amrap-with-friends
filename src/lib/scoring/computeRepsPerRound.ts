import type { WorkoutExercise } from '@/lib/api/missionTypes';
import { ScoringValidationError } from '@/lib/scoring/types';

function isScorableUnit(unit: string | undefined): boolean {
  return unit === undefined || unit === 'reps' || unit === 'sec';
}

export function computeRepsPerRound(workout: WorkoutExercise[]): number {
  if (workout.length === 0) {
    throw new ScoringValidationError('Workout must include at least one movement.');
  }

  let total = 0;

  for (const exercise of workout) {
    if (
      exercise.target === undefined ||
      !Number.isInteger(exercise.target) ||
      exercise.target <= 0
    ) {
      throw new ScoringValidationError(
        `Movement "${exercise.name}" is missing a valid rep or duration target.`
      );
    }

    if (!isScorableUnit(exercise.unit)) {
      throw new ScoringValidationError(
        `Movement "${exercise.name}" uses unit "${exercise.unit ?? 'unknown'}" which is not scorable in Phase 1.`
      );
    }

    total += exercise.target;
  }

  return total;
}
