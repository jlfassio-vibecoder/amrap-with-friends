import { describe, it, expect } from 'vitest';
import { parseWorkoutLines, parseWorkoutText } from './parseWorkoutLines';

describe('parseWorkoutLines', () => {
  it('parses leading count as reps', () => {
    expect(parseWorkoutLines(['10 Burpees'])).toEqual([
      { name: 'Burpees', target: 10, unit: 'reps' },
    ]);
  });

  it('parses name-only lines', () => {
    expect(parseWorkoutLines(['Burpees'])).toEqual([{ name: 'Burpees' }]);
  });

  it('parses trailing count with unit suffix', () => {
    expect(parseWorkoutLines(['Row 200m'])).toEqual([
      { name: 'Row', target: 200, unit: 'm' },
    ]);
  });

  it('parses trailing count without suffix as reps', () => {
    expect(parseWorkoutLines(['Push-ups 15'])).toEqual([
      { name: 'Push-ups', target: 15, unit: 'reps' },
    ]);
  });

  it('skips empty lines and parses multiple exercises', () => {
    expect(parseWorkoutText('10 Burpees\n\nRow 200m\nSquats')).toEqual([
      { name: 'Burpees', target: 10, unit: 'reps' },
      { name: 'Row', target: 200, unit: 'm' },
      { name: 'Squats' },
    ]);
  });

  it('throws when no exercises provided', () => {
    expect(() => parseWorkoutText('\n\n')).toThrow('Add at least one exercise.');
  });

  it('throws when more than 20 exercises', () => {
    const lines = Array.from({ length: 21 }, (_, i) => `Move ${i + 1}`);
    expect(() => parseWorkoutLines(lines)).toThrow('Workout can include up to 20 exercises.');
  });
});
