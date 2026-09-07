import type { MovementVariantSelection } from '@/lib/mission/exerciseScaling';

/**
 * The exact version of a workout an athlete performed — which movements they
 * scaled, and to what.
 *
 * Two consumers now share this key, so it has to be stable in both directions:
 * the progression view groups by it, and `available_ghosts` matches on it in
 * SQL to hand back the athlete's best run *of the version they are about to
 * do*. `movementVersion.contract.test.ts` runs this and the SQL side over the
 * same inputs, because a silent disagreement here does not error — it just
 * means the ghost never matches and nobody can tell why.
 */

/**
 * Code-point order, which is what Postgres `COLLATE "C"` gives on UTF-8.
 *
 * `Array.prototype.sort` compares UTF-16 code units, so an astral character
 * (emoji in a coach's movement name) sorts before U+E000–U+FFFF there and after
 * it in Postgres. Neither ordering is wrong; they just have to be the same one,
 * and a database collation is not something this key can afford to depend on.
 */
export function compareCodePoints(a: string, b: string): number {
  const left = [...a];
  const right = [...b];
  const shared = Math.min(left.length, right.length);

  for (let index = 0; index < shared; index += 1) {
    const diff = (left[index].codePointAt(0) as number) - (right[index].codePointAt(0) as number);
    if (diff !== 0) {
      return diff;
    }
  }

  return left.length - right.length;
}

/**
 * `""` for a mission performed as programmed; otherwise
 * `name#optionId|name#optionId`, movements in code-point order.
 *
 * A movement marked modified without a named scaling keeps an empty option id
 * and is therefore its own version. Merging it with a named one would claim a
 * like-for-like comparison the data does not support.
 */
export function versionKeyFor(entry: {
  modifiedMovements: readonly string[];
  movementVariants: MovementVariantSelection;
}): string {
  const names = new Set<string>([
    ...entry.modifiedMovements,
    ...Object.keys(entry.movementVariants ?? {}),
  ]);

  return [...names]
    .sort(compareCodePoints)
    .map((name) => `${name}#${entry.movementVariants?.[name] ?? ''}`)
    .join('|');
}

/** True when the mission was performed exactly as programmed. */
export function isStandardVersion(versionKey: string): boolean {
  return versionKey === '';
}
