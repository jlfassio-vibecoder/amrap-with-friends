import { describe, expect, it } from 'vitest';
import {
  isLaunchable,
  launchHref,
  shouldShowCollection,
  workoutFinishersLine,
  workoutLine,
  type RoomWorkout,
} from '@/lib/rooms/roomWorkouts';

function entry(overrides: Partial<RoomWorkout> = {}): RoomWorkout {
  return {
    workoutKey: 'the-piston',
    templateId: 'the-piston',
    workout: [{ name: 'Air Squats', unit: 'reps', target: 10 }],
    durationMinutes: 12,
    intensityTier: 3,
    scoreUnit: 'reps',
    lastRun: '2026-09-11T12:00:00.000Z',
    finishers: 4,
    ...overrides,
  };
}

describe('workoutLine', () => {
  it('names the workout when the room ran one from the library', () => {
    expect(workoutLine(entry(), 'The Piston')).toBe('The Piston');
  });

  it('falls back to the clock for a workout the coach wrote', () => {
    expect(workoutLine(entry({ templateId: null }))).toBe('12 min AMRAP');
    expect(workoutLine(entry(), '   ')).toBe('12 min AMRAP');
  });
});

describe('workoutFinishersLine', () => {
  it('counts the people who have done it here', () => {
    expect(workoutFinishersLine(entry())).toBe('4 athletes have done this');
    expect(workoutFinishersLine(entry({ finishers: 1 }))).toBe('1 athlete has done this');
  });

  it('says nothing rather than "0 athletes"', () => {
    // Printing the zero argues against the thing the collection is inviting.
    expect(workoutFinishersLine(entry({ finishers: 0 }))).toBeNull();
  });
});

describe('shouldShowCollection', () => {
  it('hides an empty collection rather than announcing one', () => {
    expect(shouldShowCollection([])).toBe(false);
    expect(shouldShowCollection([entry()])).toBe(true);
  });
});

describe('isLaunchable', () => {
  it('offers a workout whose rounds can actually be counted', () => {
    expect(isLaunchable(entry())).toBe(true);
    expect(launchHref(entry())).toBe('/create?template=the-piston');
  });

  it('refuses one the timer could not score', () => {
    // The workout jsonb goes straight to the mission, so a movement with no
    // target would hand the athlete a clock whose rounds cannot be counted.
    expect(isLaunchable(entry({ scoreUnit: 'rounds' }))).toBe(false);
    expect(isLaunchable(entry({ workout: [] }))).toBe(false);
  });

  it('refuses a workout with no template, because nothing could carry it', () => {
    // /create?template= is the only way into that page. Every room workout has
    // a template today; this is what stops a dead button shipping on the day
    // a coach can write their own.
    expect(isLaunchable(entry({ templateId: null }))).toBe(false);
    expect(launchHref(entry({ templateId: null }))).toBeNull();
  });
});

describe('what a launch actually runs', () => {
  it('links by template, and does not try to carry the stored workout', () => {
    // Deliberate, and the opposite of what the first version of this file
    // claimed. The snapshot describes the entry; the mission starts from the
    // library's current version, like every other surface that offers a
    // template. Pinning here would make this the one place in the product that
    // hands an athlete a version the product has since corrected.
    const href = launchHref(
      entry({ workout: [{ name: 'Old Movement', unit: 'reps', target: 99 }] })
    );
    expect(href).toBe('/create?template=the-piston');
    expect(href).not.toContain('Old Movement');
    expect(href).not.toContain('99');
  });
});
