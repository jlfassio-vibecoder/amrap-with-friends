import { describe, expect, it } from 'vitest';
import { computeRepsPerRound } from './computeRepsPerRound';
import { ScoringValidationError } from './types';

describe('computeRepsPerRound', () => {
  it('sums rep targets in a couplet', () => {
    expect(
      computeRepsPerRound([
        { name: 'Air Squats', target: 10, unit: 'reps' },
        { name: 'Hand-Release Push-ups', target: 10, unit: 'reps' },
      ])
    ).toBe(20);
  });

  it('treats sec holds as 1 second = 1 rep', () => {
    expect(
      computeRepsPerRound([
        { name: 'Air Squats', target: 10, unit: 'reps' },
        { name: 'Hollow Hold', target: 20, unit: 'sec' },
      ])
    ).toBe(30);
  });

  it('defaults missing unit to reps', () => {
    expect(computeRepsPerRound([{ name: 'Burpees', target: 10 }])).toBe(10);
  });

  it('throws when target is missing', () => {
    expect(() => computeRepsPerRound([{ name: 'Burpees' }])).toThrow(ScoringValidationError);
  });

  it('throws for distance units', () => {
    expect(() =>
      computeRepsPerRound([{ name: 'Row', target: 200, unit: 'm' }])
    ).toThrow(ScoringValidationError);
  });

  it('throws for empty workout', () => {
    expect(() => computeRepsPerRound([])).toThrow(ScoringValidationError);
  });
});
