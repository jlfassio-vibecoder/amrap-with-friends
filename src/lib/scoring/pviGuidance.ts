import { getPviMultiplier } from '@/lib/scoring/getPviMultiplier';

export interface PviGuidance {
  /** The band name the product already shows, e.g. "System Failure". */
  classification: string;
  /** What the number is measuring, in the reader's own value. */
  meaning: string;
  /** Why it landed in this band. Null when there is nothing to explain. */
  cause: string | null;
  /** What to change next mission. Null when nothing needs changing. */
  fix: string | null;
}

/**
 * Turn a weekly pacing average into something a reader can act on.
 *
 * The band names are deliberately dramatic — they are brand, and they sit on
 * something you read rather than something you click. What was missing is the
 * sentence underneath: an athlete told "System Failure" with no cause and no
 * remedy learns only that the app disapproves.
 */
export function describePviGuidance(pviPercent: number | null): PviGuidance {
  const { classification } = getPviMultiplier(pviPercent);

  if (pviPercent === null) {
    return {
      classification,
      meaning:
        'No pacing data yet. Log each round as you finish it and this fills in after your next mission.',
      cause: null,
      fix: null,
    };
  }

  const rounded = Math.round(pviPercent * 10) / 10;
  const meaning = `Across this week's missions, your slowest and fastest rounds differed by about ${rounded}% of your average round.`;

  if (pviPercent < 10) {
    return {
      classification,
      meaning,
      cause: null,
      fix: 'Nothing to change. Rounds that look alike from start to finish is the target.',
    };
  }

  if (pviPercent < 20) {
    return {
      classification,
      meaning,
      cause: 'Some slowing across a workout is normal and expected.',
      fix: 'If you want to tighten it, hold the first two rounds back slightly — that is where most of the spread is created.',
    };
  }

  if (pviPercent < 30) {
    return {
      classification,
      meaning,
      cause:
        'Your back half is noticeably slower than your front half, which usually means the opening rounds were faster than you could sustain.',
      fix: 'Next mission, pick a round time you believe you can repeat to the end, and hold it even while it feels easy.',
    };
  }

  return {
    classification,
    meaning,
    cause:
      'A spread this wide usually means one of two things: the opening rounds were run near maximum, or a round was interrupted — a long break, a missed Log round button, or scaling mid-workout.',
    fix: 'Next mission, deliberately run the first round slower than you think you should, and log every round as you finish it. If a round was interrupted, the splits chart will show which one.',
  };
}
