import { describe, it, expect } from 'vitest';
import { EXERCISE_LIBRARY } from '@/data/exerciseLibrary';
import { EXERCISE_SCALING } from '@/data/exerciseScaling';
import {
  formatVariantBadge,
  normalizeMovementVariants,
  readMovementVariants,
  scalingOptionById,
  scalingOptionsForMovement,
} from '@/lib/mission/exerciseScaling';

describe('the ladder data', () => {
  it('only scales exercises the library actually has', () => {
    const libraryIds = new Set(EXERCISE_LIBRARY.map((exercise) => exercise.id));
    for (const ladder of EXERCISE_SCALING) {
      expect(libraryIds.has(ladder.exerciseId), `unknown exercise ${ladder.exerciseId}`).toBe(true);
    }
  });

  it('offers a ladder for every exercise in the library', () => {
    const scaled = new Set(EXERCISE_SCALING.map((ladder) => ladder.exerciseId));
    const missing = EXERCISE_LIBRARY.filter((exercise) => !scaled.has(exercise.id));
    expect(missing.map((exercise) => exercise.id)).toEqual([]);
  });

  it('keeps a shared option id pointing at the same label', () => {
    // Shared ladders reuse ids on purpose; the pin is that the same id never
    // means two different things.
    const seen = new Map<string, string>();
    for (const ladder of EXERCISE_SCALING) {
      for (const option of ladder.options) {
        const previous = seen.get(option.id);
        if (previous !== undefined) {
          expect(previous).toBe(option.label);
        }
        seen.set(option.id, option.label);
      }
    }
  });

  it('freezes the option ids', () => {
    // Ids are stored against results. Renaming one silently rewrites an
    // athlete's history, exactly as editing a benchmark id would — so adding an
    // option is fine and changing one has to be deliberate enough to fail here.
    const ids = [
      ...new Set(EXERCISE_SCALING.flatMap((ladder) => ladder.options.map((o) => o.id))),
    ].sort();
    expect(ids).toEqual([
      'burpee--incline',
      'burpee--no-jump',
      'burpee--step',
      'cardio--low-impact',
      'cardio--slower',
      'core--bent-knees',
      'core--partial',
      'dip--feet-close',
      'dip--partial',
      'hinge--both-legs',
      'hinge--partial',
      'lunge--partial',
      'lunge--supported',
      'plank--incline',
      'plank--knees',
      'plyo--low',
      'plyo--step',
      'push-up--incline',
      'push-up--knees',
      'push-up--partial',
      'squat--box',
      'squat--partial',
      'squat--supported',
    ]);
  });

  it('says how to do each option, not just what it is called', () => {
    for (const ladder of EXERCISE_SCALING) {
      for (const option of ladder.options) {
        expect(option.label.length).toBeGreaterThan(0);
        expect(option.how.length).toBeGreaterThan(20);
      }
    }
  });
});

describe('scalingOptionsForMovement', () => {
  it('matches a workout movement through its qualifier', () => {
    // Templates write "Reverse Lunges (Total)"; the library says "Reverse Lunges".
    expect(scalingOptionsForMovement('Reverse Lunges (Total)')).toEqual(
      scalingOptionsForMovement('Reverse Lunges')
    );
    expect(scalingOptionsForMovement('Reverse Lunges (Total)').length).toBeGreaterThan(0);
  });

  it('offers the knees for a push-up', () => {
    const labels = scalingOptionsForMovement('Diamond Push-ups').map((option) => option.label);
    expect(labels).toContain('From the knees');
  });

  it('leads with the option nearest the standard movement', () => {
    const options = scalingOptionsForMovement('Standard Push-ups');
    expect(options[0].label).toBe('Hands elevated');
  });

  it('returns nothing for a movement the library does not have', () => {
    expect(scalingOptionsForMovement('Kettlebell Swings')).toEqual([]);
  });
});

describe('scalingOptionById', () => {
  it('resolves a stored id', () => {
    expect(scalingOptionById('push-up--knees')?.label).toBe('From the knees');
  });

  it('degrades quietly for an id this build does not know', () => {
    expect(scalingOptionById('push-up--retired')).toBeNull();
    expect(scalingOptionById(null)).toBeNull();
    expect(scalingOptionById(undefined)).toBeNull();
  });
});

describe('normalizeMovementVariants', () => {
  const workout = [{ name: 'Diamond Push-ups' }, { name: 'Air Squats' }];

  it('keeps a choice the movement actually offers', () => {
    expect(normalizeMovementVariants({ 'Diamond Push-ups': 'push-up--knees' }, workout)).toEqual({
      'Diamond Push-ups': 'push-up--knees',
    });
  });

  it('drops a choice for a movement not in this workout', () => {
    expect(normalizeMovementVariants({ Burpees: 'burpee--step' }, workout)).toEqual({});
  });

  it('drops an option the movement does not offer', () => {
    // A workout edited underneath a stored choice must not show an athlete a
    // scaling they never did.
    expect(normalizeMovementVariants({ 'Air Squats': 'push-up--knees' }, workout)).toEqual({});
  });

  it('tolerates null and stray shapes', () => {
    expect(normalizeMovementVariants(null, workout)).toEqual({});
    expect(
      normalizeMovementVariants({ 'Air Squats': 7 } as unknown as Record<string, string>, workout)
    ).toEqual({});
  });
});

describe('readMovementVariants', () => {
  it('tolerates null, arrays and stray values', () => {
    expect(readMovementVariants(null)).toEqual({});
    expect(readMovementVariants(['a'])).toEqual({});
    expect(readMovementVariants({ a: 'x', b: 3, c: '' })).toEqual({ a: 'x' });
  });
});

describe('formatVariantBadge', () => {
  it('names what the athlete actually did', () => {
    expect(formatVariantBadge({ 'Diamond Push-ups': 'push-up--knees' })).toBe(
      'Diamond Push-ups: from the knees'
    );
  });

  it('counts the rest once the line stops being readable', () => {
    expect(
      formatVariantBadge({ 'Diamond Push-ups': 'push-up--knees', Burpees: 'burpee--step' })
    ).toMatch(/\+1 more$/);
  });

  it('falls back to nothing when no option resolves', () => {
    // The caller keeps the plain Modified badge rather than showing an empty one.
    expect(formatVariantBadge({})).toBeNull();
    expect(formatVariantBadge({ 'Diamond Push-ups': 'push-up--retired' })).toBeNull();
    expect(formatVariantBadge(null)).toBeNull();
  });
});
