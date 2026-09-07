import type { WorkoutExercise } from '@/lib/api/missionTypes';

/**
 * A movement an athlete performed differently from the way it was programmed —
 * knee push-ups instead of diamond push-ups, say.
 *
 * The mark records what the score can honestly be compared against. It
 * deliberately does not change the score, the pacing index, the domain weight,
 * the intensity tier or the training load. Dropping a tier for an honest
 * disclosure would lower the athlete's chronic baseline, worsening the next
 * week's acute:chronic ratio, and cost them progress toward Operator — so the
 * honest answer would be the expensive one, and within a fortnight nobody would
 * give it. An AMRAP is self-paced besides: scaling a movement buys more rounds
 * at the same effort, so the effort was the effort.
 */

/** Upper bound on stored marks, so a malformed client cannot write unbounded rows. */
export const MAX_MODIFIED_MOVEMENTS = 12;

/** Longest movement name we will store, matching the workout validator's own limit. */
export const MAX_MOVEMENT_NAME_LENGTH = 120;

/**
 * Clean a set of marks for submission.
 *
 * Names rather than indices, so a mark still reads correctly if the workout is
 * edited underneath it. Only names actually present in the workout survive: a
 * mark for a movement nobody performed is noise, not data.
 */
export function normalizeModifiedMovements(
  selected: readonly string[],
  workout: readonly WorkoutExercise[]
): string[] {
  const programmed = new Map(
    workout.map((exercise) => [exercise.name.trim().toLowerCase(), exercise.name])
  );
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const raw of selected) {
    if (typeof raw !== 'string') {
      continue;
    }
    const key = raw.trim().toLowerCase();
    const canonical = programmed.get(key);
    if (canonical === undefined || seen.has(key)) {
      continue;
    }
    seen.add(key);
    cleaned.push(canonical.slice(0, MAX_MOVEMENT_NAME_LENGTH));
    if (cleaned.length >= MAX_MODIFIED_MOVEMENTS) {
      break;
    }
  }

  return cleaned;
}

export function isModifiedResult(modifiedMovements: readonly string[] | null | undefined): boolean {
  return Array.isArray(modifiedMovements) && modifiedMovements.length > 0;
}

/**
 * The badge line, e.g. "Modified: Diamond Push-ups".
 *
 * Names the movement rather than saying only "Modified", because the movement is
 * the part another athlete on the leaderboard needs in order to read the score.
 */
export function formatModifiedBadge(
  modifiedMovements: readonly string[] | null | undefined
): string | null {
  if (!isModifiedResult(modifiedMovements)) {
    return null;
  }

  const names = modifiedMovements as readonly string[];
  if (names.length === 1) {
    return `Modified: ${names[0]}`;
  }
  if (names.length === 2) {
    return `Modified: ${names[0]} and ${names[1]}`;
  }
  return `Modified: ${names.length} movements`;
}

/** Parses the column back out of a row, tolerating null and stray values. */
export function readModifiedMovements(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.slice(0, MAX_MOVEMENT_NAME_LENGTH))
    .slice(0, MAX_MODIFIED_MOVEMENTS);
}
