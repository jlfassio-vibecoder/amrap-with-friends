import { EXERCISE_SCALING, type ScalingOption } from '@/data/exerciseScaling';
import { exerciseForMovementName } from '@/lib/exercise/movementName';

/**
 * Which named scaling options a programmed movement offers, and how a chosen
 * one is read back.
 *
 * A choice made here writes the same `modified_movements` field the end-of-
 * mission checklist writes, plus the option id alongside it. One fact about
 * whether a movement was modified; the variant is detail hung off it, not a
 * second answer to the same question.
 */

const LADDER_BY_EXERCISE_ID = new Map(
  EXERCISE_SCALING.map((ladder) => [ladder.exerciseId, ladder.options])
);

const OPTION_BY_ID = new Map<string, ScalingOption>(
  EXERCISE_SCALING.flatMap((ladder) => ladder.options.map((option) => [option.id, option]))
);

/** Empty when the movement has no ladder — the plain modified mark still applies. */
export function scalingOptionsForMovement(movementName: string): ScalingOption[] {
  const exercise = exerciseForMovementName(movementName);
  if (!exercise) {
    return [];
  }
  return LADDER_BY_EXERCISE_ID.get(exercise.id) ?? [];
}

/** Null for an id this build does not know, so a retired option degrades quietly. */
export function scalingOptionById(optionId: string | null | undefined): ScalingOption | null {
  if (!optionId) {
    return null;
  }
  return OPTION_BY_ID.get(optionId) ?? null;
}

/** `{ programmed movement name: option id }`, as stored against a result. */
export type MovementVariantSelection = Record<string, string>;

/**
 * Keep only choices that name a movement in this workout and an option that
 * movement actually offers.
 *
 * A selection that survives a workout edit but no longer matches the movement is
 * worse than no selection: it would show an athlete a scaling they did not do.
 */
export function normalizeMovementVariants(
  selection: MovementVariantSelection | null | undefined,
  workout: ReadonlyArray<{ name: string }>
): MovementVariantSelection {
  if (!selection || typeof selection !== 'object') {
    return {};
  }

  const cleaned: MovementVariantSelection = {};
  for (const movement of workout) {
    const optionId = selection[movement.name];
    if (typeof optionId !== 'string') {
      continue;
    }
    const offered = scalingOptionsForMovement(movement.name);
    if (offered.some((option) => option.id === optionId)) {
      cleaned[movement.name] = optionId;
    }
  }

  return cleaned;
}

/** Parses the stored jsonb back out, tolerating nulls and stray shapes. */
export function readMovementVariants(value: unknown): MovementVariantSelection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const cleaned: MovementVariantSelection = {};
  for (const [name, optionId] of Object.entries(value as Record<string, unknown>)) {
    if (typeof optionId === 'string' && optionId.length > 0) {
      cleaned[name] = optionId;
    }
  }
  return cleaned;
}

/**
 * The badge line when the athlete named what they did — "Diamond Push-ups: from
 * the knees" rather than the bare "Modified: Diamond Push-ups".
 *
 * Falls back to null when nothing was named, so the caller keeps the plain
 * badge rather than showing an empty one.
 */
export function formatVariantBadge(
  variants: MovementVariantSelection | null | undefined
): string | null {
  const entries = Object.entries(variants ?? {});
  if (entries.length === 0) {
    return null;
  }

  const named = entries
    .map(([movementName, optionId]) => {
      const option = scalingOptionById(optionId);
      return option ? `${movementName}: ${option.label.toLowerCase()}` : null;
    })
    .filter((entry): entry is string => entry !== null);

  if (named.length === 0) {
    return null;
  }
  if (named.length === 1) {
    return named[0];
  }
  return `${named[0]} +${named.length - 1} more`;
}
