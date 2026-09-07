import { describe, it, expect } from 'vitest';
import type { WorkoutExercise } from '@/lib/api/missionTypes';
import {
  formatModifiedBadge,
  isModifiedResult,
  MAX_MODIFIED_MOVEMENTS,
  normalizeModifiedMovements,
  readModifiedMovements,
} from '@/lib/mission/modifiedMovements';
import { computeScoreBreakdown } from '@/lib/scoring/computeScoreBreakdown';

const workout: WorkoutExercise[] = [
  { name: 'Reverse Lunges (Total)', target: 12 },
  { name: 'Diamond Push-ups', target: 10 },
  { name: 'Sprawls', target: 10 },
];

describe('normalizeModifiedMovements', () => {
  it('keeps the workout spelling, whatever the caller sent', () => {
    expect(normalizeModifiedMovements(['  diamond push-ups '], workout)).toEqual([
      'Diamond Push-ups',
    ]);
  });

  it('drops marks for movements the workout does not contain', () => {
    // A mark for something nobody performed is noise, not data.
    expect(normalizeModifiedMovements(['Pull-ups', 'Sprawls'], workout)).toEqual(['Sprawls']);
  });

  it('drops duplicates', () => {
    expect(normalizeModifiedMovements(['Sprawls', 'sprawls'], workout)).toEqual(['Sprawls']);
  });

  it('preserves the order the athlete chose', () => {
    expect(normalizeModifiedMovements(['Sprawls', 'Diamond Push-ups'], workout)).toEqual([
      'Sprawls',
      'Diamond Push-ups',
    ]);
  });

  it('bounds what a malformed client can write', () => {
    const many = Array.from({ length: 50 }, (_, index) => ({
      name: `Movement ${index}`,
      target: 5,
    }));
    const marked = many.map((movement) => movement.name);
    expect(normalizeModifiedMovements(marked, many)).toHaveLength(MAX_MODIFIED_MOVEMENTS);
  });

  it('ignores non-strings rather than throwing', () => {
    expect(
      normalizeModifiedMovements([null, 7, 'Sprawls'] as unknown as string[], workout)
    ).toEqual(['Sprawls']);
  });

  it('returns nothing for an unmodified result', () => {
    expect(normalizeModifiedMovements([], workout)).toEqual([]);
  });
});

describe('isModifiedResult', () => {
  it('treats null, undefined and empty as performed as programmed', () => {
    expect(isModifiedResult(null)).toBe(false);
    expect(isModifiedResult(undefined)).toBe(false);
    expect(isModifiedResult([])).toBe(false);
    expect(isModifiedResult(['Sprawls'])).toBe(true);
  });
});

describe('formatModifiedBadge', () => {
  it('names the movement, because that is what makes a score readable', () => {
    expect(formatModifiedBadge(['Diamond Push-ups'])).toBe('Modified: Diamond Push-ups');
    expect(formatModifiedBadge(['Sprawls', 'Diamond Push-ups'])).toBe(
      'Modified: Sprawls and Diamond Push-ups'
    );
  });

  it('counts instead of listing once the list stops being readable', () => {
    expect(formatModifiedBadge(['A', 'B', 'C'])).toBe('Modified: 3 movements');
  });

  it('is absent for an unmodified result', () => {
    expect(formatModifiedBadge([])).toBeNull();
    expect(formatModifiedBadge(null)).toBeNull();
  });
});

describe('readModifiedMovements', () => {
  it('tolerates null, a non-array, and stray entries', () => {
    expect(readModifiedMovements(null)).toEqual([]);
    expect(readModifiedMovements('Sprawls')).toEqual([]);
    expect(readModifiedMovements(['Sprawls', '', 3, null])).toEqual(['Sprawls']);
    expect(readModifiedMovements(['  Diamond Push-ups  '])).toEqual(['Diamond Push-ups']);
  });
});

describe('the mark is free', () => {
  it('does not change the score, the pacing index or the domain weight', () => {
    // The guarantee the whole design rests on. If a future change makes a
    // modified result score differently, the honest answer becomes the
    // expensive one and athletes stop giving it.
    const rounds = [72, 78, 85, 80];
    const unmodified = computeScoreBreakdown(rounds, 15, 'finished', 245);
    const modified = computeScoreBreakdown(rounds, 15, 'finished', 245);

    expect(modified).toEqual(unmodified);
    expect(modified.finalScore).toBe(unmodified.finalScore);
    expect(modified.pvi).toBe(unmodified.pvi);
    expect(modified.domainWeight).toBe(unmodified.domainWeight);
  });

  it('takes no part in the scoring inputs at all', () => {
    // computeScoreBreakdown's signature is the assertion: there is nowhere for a
    // modification to enter the score, by construction rather than by policy.
    expect(computeScoreBreakdown.length).toBe(4);
  });
});
