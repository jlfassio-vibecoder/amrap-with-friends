import { EXERCISE_LIBRARY, getExerciseInfo, type ExerciseInfo } from '@/data/exerciseLibrary';
import {
  TIME_DOMAINS,
  WORKOUT_CATEGORIES,
  WORKOUT_TEMPLATES,
  type TimeDomain,
  type WorkoutCategory,
  type WorkoutTemplate,
} from '@/data/workoutTemplates';
import { allBenchmarkTemplateIds } from '@/lib/campaign/campaignBenchmarks';

/**
 * The generated half of the content layer.
 *
 * Everything here is derived from the data the app already ships — the exercise
 * library and the workout templates — so a page cannot describe a workout the
 * product does not have. Ids are the slugs: they are already kebab-case, they are
 * stable, and for benchmarks they are the one thing that must never change.
 */
export interface ContentPage {
  path: string;
  title: string;
  description: string;
}

const norm = (name: string) =>
  name
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim()
    .toLowerCase();

/** Bing and Google both prefer ~50–160 characters; we clamp at Bing's upper bound. */
const MAX_DESCRIPTION = 160;

/** Trim to a word boundary rather than mid-word, and never leave dangling punctuation. */
export function clampDescription(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= MAX_DESCRIPTION) {
    return collapsed;
  }
  const cut = collapsed.slice(0, MAX_DESCRIPTION - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : cut.length).replace(/[,.;:—-]+$/, '')}…`;
}

// ---------------------------------------------------------------- exercises

/**
 * A page ships only when it has something to say: setup, a coaching cue, an
 * AMRAP-specific tip, at least two common mistakes, and at least one workout
 * that programmes it.
 *
 * The mistakes requirement was added once the library actually had them — it
 * shipped with 72 of 73 entries empty, and gating on a field nothing populated
 * would have published nothing.
 */
export function hasEnoughToSay(exercise: ExerciseInfo): boolean {
  return (
    exercise.setupAndExecution.join(' ').trim().length >= 60 &&
    exercise.coachingCue.trim().length >= 30 &&
    (exercise.amrapTip?.trim().length ?? 0) >= 40 &&
    exercise.commonMistakes.length >= 2 &&
    workoutsUsingMovement(exercise.name).length > 0
  );
}

export function publishableExercises(): ExerciseInfo[] {
  return EXERCISE_LIBRARY.filter(hasEnoughToSay);
}

/** Every workout that programmes this movement, in template order. */
export function workoutsUsingMovement(movementName: string): WorkoutTemplate[] {
  const target = norm(movementName);
  return WORKOUT_TEMPLATES.filter((template) =>
    template.movements.some((movement) => norm(movement.name) === target)
  );
}

export function exercisePath(exercise: ExerciseInfo): string {
  return `/exercises/${exercise.id}`;
}

export function exercisePages(): ContentPage[] {
  return publishableExercises().map((exercise) => {
    const uses = workoutsUsingMovement(exercise.name).length;
    return {
      path: exercisePath(exercise),
      title: `${exercise.name} — Form, Coaching Cue and AMRAP Tips`,
      description: clampDescription(
        `How to do ${exercise.name.toLowerCase()} in an AMRAP: setup and execution, the cue that holds up under fatigue, and the ${uses} AMRAP ${uses === 1 ? 'workout' : 'workouts'} that programme it.`
      ),
    };
  });
}

// ----------------------------------------------------------------- workouts

export function categoryLabel(category: WorkoutCategory, durationMinutes?: TimeDomain): string {
  const meta = WORKOUT_CATEGORIES.find((entry) => entry.id === category);
  if (!meta) {
    return category;
  }
  const override = durationMinutes ? meta.overridesByDuration?.[durationMinutes] : undefined;
  return override?.label ?? meta.label;
}

export function categoryDescription(
  category: WorkoutCategory,
  durationMinutes?: TimeDomain
): string {
  const meta = WORKOUT_CATEGORIES.find((entry) => entry.id === category);
  if (!meta) {
    return '';
  }
  const override = durationMinutes ? meta.overridesByDuration?.[durationMinutes] : undefined;
  return override?.description ?? meta.description;
}

export function workoutsForDuration(durationMinutes: TimeDomain): WorkoutTemplate[] {
  return WORKOUT_TEMPLATES.filter((template) => template.durationMinutes === durationMinutes);
}

export function workoutsForCategory(category: WorkoutCategory): WorkoutTemplate[] {
  return WORKOUT_TEMPLATES.filter((template) => template.category === category);
}

/** How many workout detail pages we publish. Widen it once these prove out. */
export const FEATURED_WORKOUT_LIMIT = 20;

function isPublishableWorkout(template: WorkoutTemplate): boolean {
  return (
    template.movements.length >= 2 &&
    template.tacticalNote.trim().length > 0 &&
    template.category !== null &&
    // Every movement must have a library entry, or the page cannot explain how
    // to do the workout it is describing.
    template.movements.every((movement) => getExerciseInfo(movement.name) !== undefined)
  );
}

/**
 * Twenty workouts, spread evenly rather than taken off the top.
 *
 * Buckets are duration × category, and we take one from each in turn — so the
 * published set covers every time domain and every training stimulus instead of
 * twenty variations on the same five-minute sprint. Benchmarks come first inside
 * their bucket: they are the workouts a campaign is measured against, so they
 * are the ones people have a reason to look up.
 */
export function featuredWorkouts(limit: number = FEATURED_WORKOUT_LIMIT): WorkoutTemplate[] {
  const benchmarkIds = new Set(allBenchmarkTemplateIds());
  const buckets = new Map<string, WorkoutTemplate[]>();

  for (const template of WORKOUT_TEMPLATES.filter(isPublishableWorkout)) {
    const key = `${template.durationMinutes}/${template.category}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(template);
    buckets.set(key, bucket);
  }

  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => {
      const benchmarkFirst = Number(benchmarkIds.has(b.id)) - Number(benchmarkIds.has(a.id));
      return benchmarkFirst !== 0 ? benchmarkFirst : 0;
    });
  }

  const picked: WorkoutTemplate[] = [];
  const keys = [...buckets.keys()];
  for (let round = 0; picked.length < limit; round += 1) {
    let addedThisRound = false;
    for (const key of keys) {
      if (picked.length >= limit) {
        break;
      }
      const candidate = buckets.get(key)?.[round];
      if (candidate) {
        picked.push(candidate);
        addedThisRound = true;
      }
    }
    if (!addedThisRound) {
      break;
    }
  }
  return picked;
}

export function durationSegment(durationMinutes: TimeDomain): string {
  return `${durationMinutes}-minute`;
}

export function workoutPath(template: WorkoutTemplate): string {
  return `/amrap-workouts/${durationSegment(template.durationMinutes)}/${template.id}`;
}

export function durationPath(durationMinutes: TimeDomain): string {
  return `/amrap-workouts/${durationSegment(durationMinutes)}`;
}

export function categoryPath(category: WorkoutCategory): string {
  return `/amrap-workouts/style/${category}`;
}

/** "10 Air Squats, 10 Hand-Release Push-ups" — the workout itself, in one line. */
export function movementSummary(template: WorkoutTemplate): string {
  return template.movements
    .map((movement) => {
      if (movement.reps === undefined) {
        return movement.name;
      }
      const unit = movement.unit === 'sec' ? 's ' : ' ';
      return `${movement.reps}${unit}${movement.name}`;
    })
    .join(', ');
}

export function workoutPages(): ContentPage[] {
  return featuredWorkouts().map((template) => ({
    path: workoutPath(template),
    title: `${template.name} — ${template.durationMinutes} Minute AMRAP Workout`,
    description: clampDescription(
      `${template.name} is a ${template.durationMinutes}-minute AMRAP: ${movementSummary(template)}. How to pace it, how to scale it, and what a good score looks like.`
    ),
  }));
}

export function durationPages(): ContentPage[] {
  return TIME_DOMAINS.map((durationMinutes) => {
    const count = workoutsForDuration(durationMinutes).length;
    return {
      path: durationPath(durationMinutes),
      title: `${durationMinutes} Minute AMRAP Workouts — ${count} to Choose From`,
      description: clampDescription(
        `${count} ${durationMinutes}-minute AMRAP workouts you can run today, with the movements, the pacing each one asks for, and a shared timer if you want to train with friends.`
      ),
    };
  });
}

export function categoryPages(): ContentPage[] {
  return WORKOUT_CATEGORIES.map((meta) => {
    const count = workoutsForCategory(meta.id).length;
    return {
      path: categoryPath(meta.id),
      title: `${meta.label} AMRAP Workouts — ${count} Sessions`,
      description: clampDescription(
        `${count} ${meta.label} AMRAP workouts, across ${meta.availableForDurations.join(', ')} minute time domains. ${meta.description}`
      ),
    };
  });
}

/** Everything generated, for the sitemap. Hubs are static rows in routes.ts. */
export function generatedContentPages(): ContentPage[] {
  return [...durationPages(), ...categoryPages(), ...workoutPages(), ...exercisePages()];
}
