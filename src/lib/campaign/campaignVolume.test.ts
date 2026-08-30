import { describe, expect, it } from 'vitest';
import type { WorkoutTemplate } from '@/data/workoutTemplates';
import { orderPoolByVolume, repsPerRound } from './campaignVolume';

function template(id: string, reps: number[]): WorkoutTemplate {
  return {
    id,
    name: id.toUpperCase(),
    durationMinutes: 10,
    category: 'blood-shunt',
    intensityTier: 3,
    movements: reps.map((count, index) => ({ name: `Move ${index}`, reps: count })),
    tacticalNote: 'note',
  };
}

describe('repsPerRound', () => {
  it('sums the prescribed reps across every movement', () => {
    expect(repsPerRound(template('a', [10, 15, 20]))).toBe(45);
  });

  it('treats a movement with no rep count as zero', () => {
    const noReps: WorkoutTemplate = {
      ...template('a', [10]),
      movements: [{ name: 'Max effort hold' }, { name: 'Burpees', reps: 10 }],
    };
    expect(repsPerRound(noReps)).toBe(10);
  });

  it('is zero for a template with no movements', () => {
    expect(repsPerRound({ ...template('a', []), movements: [] })).toBe(0);
  });
});

describe('orderPoolByVolume', () => {
  it('puts the lightest workout first', () => {
    const ordered = orderPoolByVolume([
      template('heavy', [50]),
      template('light', [10]),
      template('middle', [30]),
    ]);
    expect(ordered.map((entry) => entry.id)).toEqual(['light', 'middle', 'heavy']);
  });

  it('keeps ties in library order, so the plan is stable', () => {
    const ordered = orderPoolByVolume([
      template('first', [20]),
      template('second', [20]),
      template('third', [20]),
    ]);
    expect(ordered.map((entry) => entry.id)).toEqual(['first', 'second', 'third']);
  });

  it('does not mutate the pool it was given', () => {
    const pool = [template('heavy', [50]), template('light', [10])];
    orderPoolByVolume(pool);
    expect(pool.map((entry) => entry.id)).toEqual(['heavy', 'light']);
  });
});
