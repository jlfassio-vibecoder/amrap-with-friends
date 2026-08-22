import type { WorkoutExercise } from '@/lib/api/sessionTypes';

const UNIT_SUFFIX_PATTERN = /^[a-z]+$/i;

export function parseWorkoutLines(lines: string[]): WorkoutExercise[] {
  const exercises: WorkoutExercise[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const leadingNumber = trimmed.match(/^(\d+)\s+(.+)$/);
    if (leadingNumber) {
      const target = Number(leadingNumber[1]);
      const remainder = leadingNumber[2].trim();
      if (!remainder) {
        throw new Error('Each workout line must include an exercise name.');
      }
      exercises.push({ name: remainder, target, unit: 'reps' });
      continue;
    }

    const trailingNumber = trimmed.match(/^(.+?)\s+(\d+)([a-z]+)?$/i);
    if (trailingNumber) {
      const name = trailingNumber[1].trim();
      const target = Number(trailingNumber[2]);
      const unitRaw = trailingNumber[3];
      if (!name) {
        throw new Error('Each workout line must include an exercise name.');
      }
      const exercise: WorkoutExercise = { name, target };
      if (unitRaw && UNIT_SUFFIX_PATTERN.test(unitRaw)) {
        exercise.unit = unitRaw.toLowerCase();
      } else if (!unitRaw) {
        exercise.unit = 'reps';
      }
      exercises.push(exercise);
      continue;
    }

    exercises.push({ name: trimmed });
  }

  if (exercises.length === 0) {
    throw new Error('Add at least one exercise.');
  }

  if (exercises.length > 20) {
    throw new Error('Workout can include up to 20 exercises.');
  }

  return exercises;
}

export function parseWorkoutText(text: string): WorkoutExercise[] {
  return parseWorkoutLines(text.split('\n'));
}
