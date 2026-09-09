import type { AmqapFlow } from '@/data/amqapFlows';

export type AmqapSide = 'left' | 'right';

/** Extra yellow time before the first side of a later per-side movement. */
export const AMQAP_EXERCISE_SWITCH_BUFFER_SEC = 5;

export interface AmqapSet {
  movementIndex: number;
  movementName: string;
  side: AmqapSide | null;
  durationSec: number;
  isLastOfRound: boolean;
  /**
   * Quality-pass reps for this set (one side, or the whole bilateral dose).
   * Null for timed holds — those are already `durationSec`.
   */
  repsPerSet: number | null;
  /** Added switch time before work. Zero on side changes and bilateral arrivals. */
  leadBufferSec: number;
}

/**
 * One quality pass: each per-side movement becomes Left then Right; bilateral
 * work is a single set. The catalog is the program — do not infer this from
 * stored workout jsonb.
 */
export function expandAmqapSets(flow: AmqapFlow): AmqapSet[] {
  const sets: AmqapSet[] = [];

  flow.movements.forEach((movement, movementIndex) => {
    const durationSec = Number.isFinite(movement.durationSecPerSet)
      ? Math.max(0, movement.durationSecPerSet)
      : 0;
    const movementName = movement.displayName || movement.name;
    const repsPerSet = repsPerSetFromMovement(movement);

    if (movement.laterality === 'per-side') {
      const leadBufferSec = movementIndex > 0 ? AMQAP_EXERCISE_SWITCH_BUFFER_SEC : 0;
      sets.push({
        movementIndex,
        movementName,
        side: 'left',
        durationSec,
        isLastOfRound: false,
        repsPerSet,
        leadBufferSec,
      });
      sets.push({
        movementIndex,
        movementName,
        side: 'right',
        durationSec,
        isLastOfRound: false,
        repsPerSet,
        leadBufferSec: 0,
      });
      return;
    }

    sets.push({
      movementIndex,
      movementName,
      side: null,
      durationSec,
      isLastOfRound: false,
      repsPerSet,
      leadBufferSec: 0,
    });
  });

  if (sets.length > 0) {
    const last = sets[sets.length - 1];
    sets[sets.length - 1] = { ...last, isLastOfRound: true };
  }

  return sets;
}

function repsPerSetFromMovement(movement: AmqapFlow['movements'][number]): number | null {
  if (movement.unit === 'sec') {
    return null;
  }
  const total = movement.reps;
  if (typeof total !== 'number' || !Number.isFinite(total) || total <= 0) {
    return null;
  }
  if (movement.laterality === 'per-side') {
    return total / 2;
  }
  return total;
}
