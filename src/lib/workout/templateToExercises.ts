import type { WorkoutExercise } from '@/lib/api/sessionTypes';
import type { WorkoutTemplate, WorkoutTemplateMovement } from '@/data/workoutTemplates';

export function templateMovementToExercise(
  movement: WorkoutTemplateMovement
): WorkoutExercise {
  if (movement.reps === undefined) {
    return { name: movement.name };
  }

  return {
    name: movement.name,
    target: movement.reps,
    unit: movement.unit ?? 'reps',
  };
}

export function templateToExercises(template: WorkoutTemplate): WorkoutExercise[] {
  return template.movements.map(templateMovementToExercise);
}

export function formatTemplateMovementLine(movement: WorkoutTemplateMovement): string {
  if (movement.reps === undefined) {
    return movement.name;
  }

  if (movement.unit === 'sec') {
    return `${movement.reps}-Sec ${movement.name}`;
  }

  if (movement.unit && movement.unit !== 'reps') {
    return `${movement.name} ${movement.reps}${movement.unit}`;
  }

  return `${movement.reps} ${movement.name}`;
}

export function exercisesToWorkoutText(exercises: WorkoutExercise[]): string {
  return exercises
    .map((exercise) => {
      if (exercise.target === undefined) {
        return exercise.name;
      }

      if (exercise.unit && exercise.unit !== 'reps') {
        return `${exercise.name} ${exercise.target}${exercise.unit}`;
      }

      return `${exercise.target} ${exercise.name}`;
    })
    .join('\n');
}

export function applyTemplate(template: WorkoutTemplate): {
  durationMinutes: number;
  workoutText: string;
} {
  return {
    durationMinutes: template.durationMinutes,
    workoutText: exercisesToWorkoutText(templateToExercises(template)),
  };
}
