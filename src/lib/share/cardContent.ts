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

/** Reads the movements out of the mission's stored workout jsonb, tolerating anything malformed. */
export function cardMovements(data: ReplayData): CardMovement[] {
  const workout = data.mission.workout;
  const raw = (workout && typeof workout === 'object' ? workout : {}) as Record<string, unknown>;
  const movements = Array.isArray(raw.movements) ? raw.movements : [];
  return movements
    .map((entry) => {
      const row = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
      const name = typeof row.name === 'string' ? row.name : '';
      return {
        name,
        reps: typeof row.reps === 'number' && Number.isFinite(row.reps) ? row.reps : null,
        unit: typeof row.unit === 'string' && row.unit ? row.unit : null,
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
