import { describe, it, expect } from 'vitest';
import { WORKOUT_TEMPLATES, TIME_DOMAINS } from '@/data/workoutTemplates';
import { EXERCISE_LIBRARY } from '@/data/exerciseLibrary';
import {
  categoryProfiles,
  durationProfiles,
  libraryTotals,
  movementFrequency,
} from '@/lib/seo/libraryStats';

describe('movementFrequency', () => {
  const frequency = movementFrequency();

  it('never reports a movement in more workouts than exist', () => {
    for (const entry of frequency) {
      expect(entry.workouts, entry.name).toBeGreaterThan(0);
      expect(entry.workouts, entry.name).toBeLessThanOrEqual(WORKOUT_TEMPLATES.length);
    }
  });

  it('is sorted by how often a movement is programmed', () => {
    const counts = frequency.map((entry) => entry.workouts);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it('resolves each movement back to its library entry so the page can link it', () => {
    const unresolved = frequency.filter((entry) => entry.exerciseId === null);
    expect(unresolved).toEqual([]);
  });

  it('states share as a percentage of all workouts', () => {
    const top = frequency[0];
    expect(top.share).toBeCloseTo((top.workouts / WORKOUT_TEMPLATES.length) * 100, 1);
  });

  it('counts a workout once even if it programmes the movement twice', () => {
    const total = frequency.reduce((sum, entry) => sum + entry.workouts, 0);
    const upperBound = WORKOUT_TEMPLATES.reduce(
      (sum, template) => sum + template.movements.length,
      0
    );
    expect(total).toBeLessThanOrEqual(upperBound);
  });
});

describe('durationProfiles', () => {
  const profiles = durationProfiles();

  it('covers every time domain', () => {
    expect(profiles.map((profile) => profile.durationMinutes)).toEqual(TIME_DOMAINS);
  });

  it('accounts for every workout', () => {
    const total = profiles.reduce((sum, profile) => sum + profile.workouts, 0);
    expect(total).toBe(WORKOUT_TEMPLATES.length);
  });

  it('reports averages that fall inside the observed range', () => {
    for (const profile of profiles) {
      const templates = WORKOUT_TEMPLATES.filter(
        (template) => template.durationMinutes === profile.durationMinutes
      );
      const counts = templates.map((template) => template.movements.length);
      expect(profile.averageMovements).toBeGreaterThanOrEqual(Math.min(...counts));
      expect(profile.averageMovements).toBeLessThanOrEqual(Math.max(...counts));
      expect(counts).toContain(profile.commonestMovementCount);
    }
  });
});

describe('libraryTotals', () => {
  it('reports the real size of the library, not a rounded claim', () => {
    const totals = libraryTotals();
    expect(totals.workouts).toBe(WORKOUT_TEMPLATES.length);
    expect(totals.movements).toBe(EXERCISE_LIBRARY.length);
    expect(totals.timeDomains).toBe(TIME_DOMAINS.length);
  });

  it('counts the long tail of single-use movements', () => {
    const totals = libraryTotals();
    expect(totals.singleUseMovements).toBe(
      movementFrequency().filter((entry) => entry.workouts === 1).length
    );
  });
});

describe('categoryProfiles', () => {
  it('accounts for every workout across the categories', () => {
    const total = categoryProfiles().reduce((sum, profile) => sum + profile.workouts, 0);
    expect(total).toBe(WORKOUT_TEMPLATES.length);
  });
});
