import type { ReplayData, ReplayRound } from '@/lib/share/types';

/**
 * The things a result is actually made of.
 *
 * The first card shipped with the score, the name and a one-row leaderboard,
 * and about sixty percent of it empty — it left out what the workout was and
 * how the effort was paced, which is most of what someone posting a result
 * wants to show. Everything here comes from data already in ReplayData; none
 * of it needed a schema change, only reading what was already fetched.
 */

export interface CardMovement {
  name: string;
  reps: number | null;
  unit: string | null;
}

/** `10 Air Squats`, or `Plank` when a movement carries no rep count. */
export function formatMovement(movement: CardMovement): string {
  if (movement.reps === null) {
    return movement.name;
  }
  return movement.unit
    ? `${movement.reps} ${movement.unit} ${movement.name}`
    : `${movement.reps} ${movement.name}`;
}

/**
 * Reads the movements out of the mission's stored workout jsonb.
 *
 * The stored shape is a bare array of `{ name, unit, target }` — verified
 * against a real row, after a first version of this function was written
 * against an invented `{ movements: [{ reps }] }` shape, passed its own tests,
 * and shipped a card with no movements and a rep total of zero. Both shapes
 * are accepted now because the object form is what the design document
 * describes, and a stored row could yet appear in either.
 */
export function cardMovements(data: ReplayData): CardMovement[] {
  const workout = data.mission.workout;
  const movements = Array.isArray(workout)
    ? workout
    : Array.isArray((workout as Record<string, unknown> | null)?.movements)
      ? ((workout as Record<string, unknown>).movements as unknown[])
      : [];
  return movements
    .map((entry) => {
      const row = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
      const name = typeof row.name === 'string' ? row.name : '';
      // `target` is what the rows actually carry; `reps` is the design's name
      // for the same field.
      const count = [row.target, row.reps].find(
        (value) => typeof value === 'number' && Number.isFinite(value)
      );
      const unit = typeof row.unit === 'string' && row.unit ? row.unit : null;
      return {
        name,
        reps: typeof count === 'number' ? count : null,
        // "10 reps Air Squats" reads worse than "10 Air Squats", and `reps` is
        // the unit on almost every movement in the library.
        unit: unit === 'reps' ? null : unit,
      };
    })
    .filter((movement) => movement.name.length > 0);
}

export interface RoundSplit {
  n: number;
  seconds: number;
}

/**
 * Per-round durations, by subtracting each round's timestamp from the previous.
 *
 * The splits are the interesting part of a result — they are what shows
 * somebody went out fast and paid for it — and the app already displays them
 * on the scorecard, so a card that omits them shows less than the screen the
 * athlete just looked at.
 */
export function roundSplits(rounds: ReplayRound[], participantId: string): RoundSplit[] {
  const mine = rounds
    .filter((round) => round.participantId === participantId)
    .sort((a, b) => a.atSeconds - b.atSeconds);

  let previous = 0;
  return mine.map((round, index) => {
    const seconds = Math.max(0, round.atSeconds - previous);
    previous = round.atSeconds;
    return { n: index + 1, seconds };
  });
}

/** Seconds as m:ss, matching the clock on the scorecard. */
export function formatSplit(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/**
 * A board is only worth drawing when there is somebody to compare against.
 * On a solo mission the single row just restates the hero, which is what left
 * the first card looking empty.
 */
export function shouldDrawBoard(data: ReplayData): boolean {
  return data.participants.length > 1;
}
