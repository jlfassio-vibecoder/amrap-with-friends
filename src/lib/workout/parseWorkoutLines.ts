import type { WorkoutExercise } from '@/lib/api/sessionTypes';

const UNIT_SUFFIX_PATTERN = /^([a-z]+)$/i;

function parseUnitSuffix(raw: string): { target: number; unit: string } | null {
  const match = raw.match(/^(\d+)\s*([a-z]+)$/i);
  if (!match) {
    return null;
  }
  const target = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(target) || target <= 0) {
    return null;
  }
  return { target, unit };
}

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

    const suffixOnly = trimmed.match(/^(.+?)\s+(\d+[a-z]+)$/i);
    if (suffixOnly) {
      const name = suffixOnly[1].trim();
      const parsed = parseUnitSuffix(suffixOnly[2]);
      if (!name || !parsed) {
        throw new Error('Invalid workout line format.');
      }
      exercises.push({ name, target: parsed.target, unit: parsed.unit });
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
