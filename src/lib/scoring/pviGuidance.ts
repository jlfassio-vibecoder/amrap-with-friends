import { shouldExcludeBuyInRound } from '@/lib/scoring/getPacingDurations';
import { MIN_TIME_CAP } from '@/lib/timeDomains';

export interface WeeklyPviGuidance {
  /** What the number measures. Always present. */
  meaning: string;
  /** Why it may read high for reasons that are not pacing. Null when it is low. */
  cause: string | null;
  /** What to change next mission. Null when nothing needs changing. */
  fix: string | null;
}

/**
 * Describe a week's average pacing spread.
 *
 * Two things this deliberately does not do.
 *
 * It does not compare rounds across missions. Each mission's spread is computed
 * on its own rounds and only the resulting percentages are averaged, so a
 * two-minute round in a 20-minute AMRAP is never measured against a
 * forty-five-second round in a five-minute one. Copy here has to say so,
 * because a sentence that reads as though it pools rounds makes a correct
 * number look broken.
 *
 * It does not carry the single-mission band names — Elite Pacing, Power Leak,
 * System Failure. Those grade one mission and set its score multiplier. A mean
 * of several missions has no multiplier, and labelling it with them announces a
 * failure that may belong to one workout out of six while hiding which one.
 */
export function describeWeeklyPviGuidance(pviPercent: number | null): WeeklyPviGuidance {
  if (pviPercent === null) {
    return {
      meaning:
        'No pacing data yet. Log each round as you finish it and this fills in after your next mission.',
      cause: null,
      fix: null,
    };
  }

  const rounded = Math.round(pviPercent * 10) / 10;
  const meaning = `Each mission is scored on its own rounds — slowest minus fastest, against that mission's average. Your missions this week averaged ${rounded}%.`;

  if (pviPercent < 10) {
    return {
      meaning,
      cause: null,
      fix: 'Nothing to change. Rounds that look alike is the target.',
    };
  }

  if (pviPercent < 20) {
    return {
      meaning,
      cause: 'Some slowing across a workout is normal and expected.',
      fix: 'To tighten it, hold the first two rounds back slightly — that is where most of the spread is created.',
    };
  }

  // Above 20% the number is worth explaining rather than grading, because an
  // average hides its own shape: one rough mission in six moves it as much as
  // six mediocre ones, and the athlete cannot tell which happened from here.
  const shortMissionNote = `Short missions also read higher here by design: on a mission of ${MIN_TIME_CAP}–${MIN_TIME_CAP + 2} minutes every round counts, including the fast opener, while longer missions leave it out.`;

  if (pviPercent < 30) {
    return {
      meaning,
      cause: `This is an average, so one uneven mission moves it as much as several mildly uneven ones. ${shortMissionNote}`,
      fix: 'Open the splits on a mission to see its own spread. If a mission was genuinely uneven, pick a round time you believe you can repeat to the end and hold it.',
    };
  }

  return {
    meaning,
    cause: `This is an average, so a single rough mission can carry it — check the splits on each before reading it as a pattern. A wide spread on one mission usually means the opening rounds were run near maximum, or a round was interrupted: a long break, a missed Log round button, or scaling mid-workout. ${shortMissionNote}`,
    fix: 'Open the splits on your missions to find which one was uneven. On that kind of workout next time, run the first round slower than you think you should, and log every round as you finish it.',
  };
}

/** True when a cap of this length keeps its opening round in the spread. */
export function countsBuyInRound(durationMinutes: number): boolean {
  return !shouldExcludeBuyInRound(durationMinutes);
}
