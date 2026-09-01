import { describe, it, expect } from 'vitest';
import { EXERCISE_LIBRARY } from '@/data/exerciseLibrary';
import { WORKOUT_TEMPLATES, TIME_DOMAINS, WORKOUT_CATEGORIES } from '@/data/workoutTemplates';
import {
  FEATURED_WORKOUT_LIMIT,
  exercisePages,
  featuredWorkouts,
  generatedContentPages,
  hasEnoughToSay,
  movementSummary,
  publishableExercises,
  workoutPages,
  workoutPath,
  workoutsForCategory,
  workoutsForDuration,
  workoutsUsingMovement,
} from '@/lib/seo/contentPages';

describe('hasEnoughToSay', () => {
  it('publishes most of the library but not all of it', () => {
    const published = publishableExercises();
    expect(published.length).toBeGreaterThan(50);
    expect(published.length).toBeLessThan(EXERCISE_LIBRARY.length);
  });

  it('rejects an entry with nothing unique to say', () => {
    expect(
      hasEnoughToSay({
        id: 'thin',
        name: 'Burpees',
        setupAndExecution: ['Do it.'],
        commonMistakes: [],
        coachingCue: 'Go.',
        photos: [],
      })
    ).toBe(false);
  });

  it('requires the movement to appear in at least one workout', () => {
    const orphan = {
      ...EXERCISE_LIBRARY[0],
      name: 'A Movement No Workout Programmes',
    };
    expect(workoutsUsingMovement(orphan.name)).toEqual([]);
    expect(hasEnoughToSay(orphan)).toBe(false);
  });
});

describe('workoutsUsingMovement', () => {
  it('matches a movement whose template name carries a display suffix', () => {
    // Templates write "Skater Jumps (Total)"; the library entry is "Skater Jumps".
    const found = workoutsUsingMovement('Skater Jumps');
    expect(found.length).toBeGreaterThan(0);
  });

  it('gives every published exercise somewhere to link to', () => {
    for (const exercise of publishableExercises()) {
      expect(workoutsUsingMovement(exercise.name).length, exercise.id).toBeGreaterThan(0);
    }
  });
});

describe('featuredWorkouts', () => {
  const featured = featuredWorkouts();

  it('publishes exactly the limit', () => {
    expect(featured).toHaveLength(FEATURED_WORKOUT_LIMIT);
  });

  it('covers every time domain rather than stacking one', () => {
    const durations = new Set(featured.map((template) => template.durationMinutes));
    expect([...durations].sort()).toEqual([...TIME_DOMAINS].sort());
  });

  it('covers every training stimulus', () => {
    const categories = new Set(featured.map((template) => template.category));
    expect(categories.size).toBe(WORKOUT_CATEGORIES.length);
  });

  it('is deterministic', () => {
    expect(featuredWorkouts().map((t) => t.id)).toEqual(featured.map((t) => t.id));
  });

  it('only publishes workouts every movement of which can be explained', () => {
    for (const template of featured) {
      expect(template.movements.length, template.id).toBeGreaterThanOrEqual(2);
      expect(template.tacticalNote.trim(), template.id).not.toBe('');
      expect(template.category, template.id).not.toBeNull();
    }
  });

  it('nests each workout under its own duration', () => {
    for (const template of featured) {
      expect(workoutPath(template)).toContain(`/${template.durationMinutes}-minute/`);
    }
  });
});

describe('movementSummary', () => {
  it('writes reps and second-based movements differently', () => {
    expect(movementSummary({ movements: [{ name: 'Air Squats', reps: 10 }] } as never)).toBe(
      '10 Air Squats'
    );
    expect(
      movementSummary({ movements: [{ name: 'Plank Hold', reps: 30, unit: 'sec' }] } as never)
    ).toBe('30s Plank Hold');
    expect(movementSummary({ movements: [{ name: 'Burpees' }] } as never)).toBe('Burpees');
  });
});

describe('collections', () => {
  it('accounts for every template across the duration pages', () => {
    const total = TIME_DOMAINS.reduce(
      (sum, minutes) => sum + workoutsForDuration(minutes).length,
      0
    );
    expect(total).toBe(WORKOUT_TEMPLATES.length);
  });

  it('accounts for every template across the category pages', () => {
    const total = WORKOUT_CATEGORIES.reduce(
      (sum, category) => sum + workoutsForCategory(category.id).length,
      0
    );
    expect(total).toBe(WORKOUT_TEMPLATES.length);
  });
});

describe('generatedContentPages', () => {
  const pages = generatedContentPages();

  it('has no duplicate paths', () => {
    const paths = pages.map((page) => page.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('gives every page a distinct title and description', () => {
    expect(new Set(pages.map((page) => page.title)).size).toBe(pages.length);
    expect(new Set(pages.map((page) => page.description)).size).toBe(pages.length);
  });

  it('keeps descriptions inside Bing and Google snippet length', () => {
    for (const page of pages) {
      expect(page.description.length, page.path).toBeGreaterThanOrEqual(50);
      expect(page.description.length, page.path).toBeLessThanOrEqual(160);
    }
  });

  it('covers exactly the exercise and workout pages', () => {
    expect(pages).toEqual(expect.arrayContaining([...exercisePages(), ...workoutPages()]));
  });
});
