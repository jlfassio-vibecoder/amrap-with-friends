import { EXERCISE_LIBRARY } from '@/data/exerciseLibrary';
import {
  TIME_DOMAINS,
  WORKOUT_CATEGORIES,
  WORKOUT_TEMPLATES,
  type TimeDomain,
} from '@/data/workoutTemplates';

/**
 * Original data, computed from the library at build time.
 *
 * This is what we can publish honestly today: how 150 AMRAP workouts are
 * actually built. The athlete-side numbers the roadmap wants — median rounds on
 * a given workout, the distribution of pacing scores — need volume we do not
 * have yet, and inventing them would be worse than not publishing.
 */
const norm = (name: string) =>
  name
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim()
    .toLowerCase();

export interface MovementFrequency {
  name: string;
  exerciseId: string | null;
  workouts: number;
  /** Share of all workouts, to one decimal place. */
  share: number;
}

export function movementFrequency(): MovementFrequency[] {
  const counts = new Map<string, number>();
  for (const template of WORKOUT_TEMPLATES) {
    // A movement programmed twice in one workout still only counts once here:
    // the question is how many workouts use it, not how many times it appears.
    const seen = new Set(template.movements.map((movement) => norm(movement.name)));
    for (const name of seen) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }

  const byNormalizedName = new Map(EXERCISE_LIBRARY.map((entry) => [norm(entry.name), entry]));

  return [...counts.entries()]
    .map(([name, workouts]) => {
      const entry = byNormalizedName.get(name);
      return {
        name: entry?.name ?? name,
        exerciseId: entry?.id ?? null,
        workouts,
        share: Math.round((workouts / WORKOUT_TEMPLATES.length) * 1000) / 10,
      };
    })
    .sort((a, b) => b.workouts - a.workouts || a.name.localeCompare(b.name));
}

export interface DurationProfile {
  durationMinutes: TimeDomain;
  workouts: number;
  /** Mean number of movements in a round at this time cap. */
  averageMovements: number;
  /** Mean total reps in one round, counting a second-based movement as one rep. */
  averageRepsPerRound: number;
  /** The most common movement count in a round at this cap. */
  commonestMovementCount: number;
}

export function durationProfiles(): DurationProfile[] {
  return TIME_DOMAINS.map((durationMinutes) => {
    const templates = WORKOUT_TEMPLATES.filter(
      (template) => template.durationMinutes === durationMinutes
    );
    const movementCounts = templates.map((template) => template.movements.length);
    const repTotals = templates.map((template) =>
      template.movements.reduce(
        (sum, movement) => sum + (movement.unit === 'sec' ? 1 : (movement.reps ?? 0)),
        0
      )
    );
    const tally = new Map<number, number>();
    for (const count of movementCounts) {
      tally.set(count, (tally.get(count) ?? 0) + 1);
    }
    const commonest = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];

    return {
      durationMinutes,
      workouts: templates.length,
      averageMovements: round1(mean(movementCounts)),
      averageRepsPerRound: Math.round(mean(repTotals)),
      commonestMovementCount: commonest?.[0] ?? 0,
    };
  });
}

export interface CategoryProfile {
  id: string;
  label: string;
  workouts: number;
  durations: TimeDomain[];
}

export function categoryProfiles(): CategoryProfile[] {
  return WORKOUT_CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label,
    workouts: WORKOUT_TEMPLATES.filter((template) => template.category === category.id).length,
    durations: category.availableForDurations,
  }));
}

export interface LibraryTotals {
  workouts: number;
  movements: number;
  timeDomains: number;
  categories: number;
  /** Movements used in exactly one workout — the long tail of the library. */
  singleUseMovements: number;
  medianWorkoutsPerMovement: number;
}

export function libraryTotals(): LibraryTotals {
  const frequency = movementFrequency();
  const counts = frequency.map((entry) => entry.workouts).sort((a, b) => a - b);
  return {
    workouts: WORKOUT_TEMPLATES.length,
    movements: EXERCISE_LIBRARY.length,
    timeDomains: TIME_DOMAINS.length,
    categories: WORKOUT_CATEGORIES.length,
    singleUseMovements: frequency.filter((entry) => entry.workouts === 1).length,
    medianWorkoutsPerMovement: median(counts),
  };
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(sorted: number[]): number {
  if (sorted.length === 0) {
    return 0;
  }
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? round1((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
