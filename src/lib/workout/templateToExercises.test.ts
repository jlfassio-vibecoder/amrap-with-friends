import { describe, it, expect } from 'vitest';
import { WORKOUT_TEMPLATES } from '@/data/workoutTemplates';
import { parseWorkoutText } from './parseWorkoutLines';
import {
  applyTemplate,
  exercisesToWorkoutText,
  templateMovementToExercise,
  templateToExercises,
} from './templateToExercises';

describe('templateMovementToExercise', () => {
  it('maps reps to target with default unit reps', () => {
    expect(templateMovementToExercise({ name: 'Air Squats', reps: 10 })).toEqual({
      name: 'Air Squats',
      target: 10,
      unit: 'reps',
    });
  });

  it('preserves custom unit', () => {
    expect(templateMovementToExercise({ name: 'Row', reps: 200, unit: 'm' })).toEqual({
      name: 'Row',
      target: 200,
      unit: 'm',
    });
  });

  it('maps name-only movements', () => {
    expect(templateMovementToExercise({ name: 'Burpees' })).toEqual({ name: 'Burpees' });
  });

  it('preserves parenthetical technique cues in name', () => {
    expect(
      templateMovementToExercise({ name: 'Commando Planks (Up-Downs)', reps: 10 })
    ).toEqual({
      name: 'Commando Planks (Up-Downs)',
      target: 10,
      unit: 'reps',
    });
  });
});

describe('exercisesToWorkoutText', () => {
  it('formats leading-count reps lines', () => {
    expect(
      exercisesToWorkoutText([
        { name: 'Air Squats', target: 10, unit: 'reps' },
        { name: 'Hand-Release Push-ups', target: 10, unit: 'reps' },
      ])
    ).toBe('10 Air Squats\n10 Hand-Release Push-ups');
  });

  it('formats trailing unit lines', () => {
    expect(exercisesToWorkoutText([{ name: 'Row', target: 200, unit: 'm' }])).toBe('Row 200m');
  });

  it('formats name-only lines', () => {
    expect(exercisesToWorkoutText([{ name: 'Burpees' }])).toBe('Burpees');
  });
});

describe('templateToExercises round-trip', () => {
  it('round-trips The Piston through parseWorkoutText', () => {
    const template = WORKOUT_TEMPLATES.find((entry) => entry.id === 'the-piston');
    expect(template).toBeDefined();
    if (!template) {
      return;
    }

    const text = exercisesToWorkoutText(templateToExercises(template));
    expect(parseWorkoutText(text)).toEqual(templateToExercises(template));
  });

  it('round-trips Shock & Awe with total-count shoulder taps', () => {
    const template = WORKOUT_TEMPLATES.find((entry) => entry.id === 'shock-and-awe');
    expect(template).toBeDefined();
    if (!template) {
      return;
    }

    const text = exercisesToWorkoutText(templateToExercises(template));
    expect(text).toBe('10 Jump Squats\n20 Plank Shoulder Taps');
    expect(parseWorkoutText(text)).toEqual(templateToExercises(template));
  });
});

describe('applyTemplate', () => {
  it('sets duration and workout text from a template', () => {
    const template = WORKOUT_TEMPLATES[0];
    expect(applyTemplate(template)).toEqual({
      durationMinutes: 5,
      workoutText: '10 Air Squats\n10 Hand-Release Push-ups',
    });
  });
});
