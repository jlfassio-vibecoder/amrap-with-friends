import { describe, it, expect } from 'vitest';
import { WORKOUT_TEMPLATES } from '@/data/workoutTemplates';
import { parseWorkoutText } from './parseWorkoutLines';
import {
  applyTemplate,
  exercisesToWorkoutText,
  formatTemplateMovementLine,
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

  it('formats timed holds with trailing sec unit', () => {
    expect(
      exercisesToWorkoutText([{ name: 'Bottom Squat Hold', target: 10, unit: 'sec' }])
    ).toBe('Bottom Squat Hold 10sec');
  });
});

describe('formatTemplateMovementLine', () => {
  it('displays sec holds with a readable prefix', () => {
    expect(
      formatTemplateMovementLine({ name: 'Bottom Squat Hold', reps: 10, unit: 'sec' })
    ).toBe('10-Sec Bottom Squat Hold');
    expect(formatTemplateMovementLine({ name: 'Hollow Hold', reps: 15, unit: 'sec' })).toBe(
      '15-Sec Hollow Hold'
    );
  });
});

describe('timed hold round-trip', () => {
  it('round-trips Bottom Squat Hold through parseWorkoutText', () => {
    const movement = templateMovementToExercise({
      name: 'Bottom Squat Hold',
      reps: 10,
      unit: 'sec',
    });
    const text = exercisesToWorkoutText([movement]);
    expect(text).toBe('Bottom Squat Hold 10sec');
    expect(parseWorkoutText(text)).toEqual([movement]);
  });

  it('round-trips Hollow Hold through parseWorkoutText', () => {
    const movement = templateMovementToExercise({
      name: 'Hollow Hold',
      reps: 15,
      unit: 'sec',
    });
    const text = exercisesToWorkoutText([movement]);
    expect(text).toBe('Hollow Hold 15sec');
    expect(parseWorkoutText(text)).toEqual([movement]);
  });

  it('round-trips The Acid Bath template including sec hold', () => {
    const template = WORKOUT_TEMPLATES.find((entry) => entry.id === 'the-acid-bath');
    expect(template).toBeDefined();
    if (!template) {
      return;
    }

    const text = exercisesToWorkoutText(templateToExercises(template));
    expect(text).toBe('8 Jump Squats\n12 Air Squats\nBottom Squat Hold 10sec');
    expect(parseWorkoutText(text)).toEqual(templateToExercises(template));
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
