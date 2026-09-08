import {
  getPviMultiplier,
  PVI_ELITE_CEILING,
  PVI_STANDARD_CEILING,
  PVI_POWER_LEAK_CEILING,
} from '@/lib/scoring/getPviMultiplier';
import { formatMultiplier } from '@/lib/scoring/formatMultiplier';

export type ScoreStatId =
  | 'finalScore'
  | 'baseScore'
  | 'pviMultiplier'
  | 'domainWeight'
  | 'pviVariance'
  | 'pacingClassification';

export interface ScoreStatGuidanceRow {
  label: string;
  value: string;
}

export interface ScoreStatGuidance {
  /** Matches the label on the card, so the modal reads as "more about this" rather than a new topic. */
  title: string;
  whatItIs: string;
  howItsCalculated: string;
  whatItMeasures: string;
  howToUseIt: string;
  /** A small reference table, shown under the prose, for the two stats built on bands rather than a formula. */
  table?: {
    caption: string;
    rows: ScoreStatGuidanceRow[];
  };
}

/**
 * The four pacing bands, read back from `getPviMultiplier` at one sample
 * point inside each — rather than copied out as strings — so this table
 * cannot go stale if the bands, their names, or their multipliers change.
 * Only the boundary numbers themselves come from the exported ceilings.
 */
function pviBandRows(value: (percent: number) => string): ScoreStatGuidanceRow[] {
  const eliteSample = 0;
  const standardSample = (PVI_ELITE_CEILING + PVI_STANDARD_CEILING) / 2;
  const powerLeakSample = (PVI_STANDARD_CEILING + PVI_POWER_LEAK_CEILING) / 2;
  const systemFailureSample = PVI_POWER_LEAK_CEILING + 5;

  return [
    { label: `Under ${PVI_ELITE_CEILING}%`, value: value(eliteSample) },
    {
      label: `${PVI_ELITE_CEILING}–${PVI_STANDARD_CEILING - 1}%`,
      value: value(standardSample),
    },
    {
      label: `${PVI_STANDARD_CEILING}–${PVI_POWER_LEAK_CEILING - 1}%`,
      value: value(powerLeakSample),
    },
    { label: `${PVI_POWER_LEAK_CEILING}% and up`, value: value(systemFailureSample) },
  ];
}

/**
 * Base score is reps for most workouts but rounds for the handful that
 * aren't reps-countable (`repsPerRound === 0`, e.g. a workout scored on
 * distance) — the only stat whose explanation depends on the workout it's
 * describing rather than being fixed prose. `repsPerRound` unset is treated
 * as reps-based, the common case and what this always said before a caller
 * could tell it otherwise.
 */
function baseScoreGuidance(repsPerRound: number | undefined): ScoreStatGuidance {
  const isRoundsBased = repsPerRound === 0;

  return {
    title: 'Base score',
    whatItIs: 'The raw work you did this mission, before pacing or clock length are factored in.',
    // A round-based workout has no fixed reps-per-round total to multiply —
    // computeBaseScore never runs for one, so there is no partial-reps term
    // to mention either; base score is just the round count.
    howItsCalculated: isRoundsBased
      ? "Rounds completed — this workout isn't scored in reps, so partial reps aren't counted."
      : 'Full rounds × reps per round, plus any partial reps you logged.',
    whatItMeasures: isRoundsBased
      ? 'Volume — the total rounds you completed, nothing else.'
      : 'Volume — the total reps you completed, nothing else.',
    howToUseIt:
      "Track this across repeats of the same workout to see if you're getting fitter or faster at it. It won't tell you whether you paced it well — that's what P.V.I. is for, below.",
  };
}

const GUIDANCE: Record<Exclude<ScoreStatId, 'baseScore'>, ScoreStatGuidance> = {
  finalScore: {
    title: 'Final score',
    whatItIs:
      "The number you're actually ranked on — what shows up on the leaderboard and in your mission history.",
    howItsCalculated: 'Base score × P.V.I. multiplier × Domain, rounded to the nearest point.',
    whatItMeasures:
      'How much work you did, adjusted for how evenly you paced it and how much that clock length is worth.',
    howToUseIt:
      'Two missions with the same base score can post very different final scores — the one paced more evenly, or run on a longer clock, comes out ahead. If you want a bigger number, more reps, steadier pacing, and a clock you can actually sustain all move it.',
  },
  // baseScore is built by baseScoreGuidance() instead — its wording depends on
  // whether the workout is reps-countable, so it isn't a static entry here.
  pviMultiplier: {
    title: 'P.V.I. multiplier',
    whatItIs:
      'How your pacing consistency (the P.V.I. variance below) turns into real points on your final score — a bonus for even pacing, a penalty for uneven pacing.',
    howItsCalculated:
      'Your P.V.I. variance percentage is looked up on a scale from a bonus down to a penalty:',
    whatItMeasures: 'Whether you paced the mission like a plan or like a scramble.',
    howToUseIt:
      "This is worth chasing on purpose: the same base score is worth 35% more at the top of the scale than the bottom. If you're trying to raise your final score, holding an even pace is often a bigger lever than trying to go out faster.",
    table: {
      caption: 'P.V.I. variance → multiplier',
      rows: pviBandRows((percent) => formatMultiplier(getPviMultiplier(percent).multiplier)),
    },
  },
  domainWeight: {
    title: 'Domain',
    whatItIs: "How much this mission's clock length is worth toward your final score.",
    howItsCalculated:
      '5-minute missions are worth × 1.0, 10-minute × 1.2, 15-minute × 1.5, and 20-minute × 1.8. Clocks in between are worth a proportional amount in-between, so there is never a jump in value for adding one extra minute.',
    whatItMeasures: 'The fact that grinding for 20 minutes is a harder ask than 5.',
    howToUseIt:
      'A longer mission scores higher for the same effort level — but only if you can hold your pace for the whole clock. Going out too hot on a 20-minute AMRAP usually costs more in the P.V.I. multiplier than the extra Domain weight is worth.',
  },
  pviVariance: {
    title: 'P.V.I. variance',
    whatItIs:
      'Short for Pace Variance Index — how much your round times spread out over the mission, as a percentage.',
    howItsCalculated:
      '(Slowest round − fastest round) ÷ average round time, × 100. Your opening round is left out of this on any mission long enough to have one: it is almost always your fastest, since you are fresh and have no feedback yet, and counting it would mark honest pacing as a collapse.',
    whatItMeasures:
      'Consistency, not speed. A low number means every round looked about the same; a high number means one or more rounds were a lot slower than the rest.',
    howToUseIt:
      'If this reads high, open the splits chart to find the round that blew up — that is almost always where you went out too fast early, hit a wall, or took an unplanned break. It is also fragile to one small thing: forgetting to tap Log round. A late tap inflates one split and deflates the next, hitting both ends of this formula at once — one missed button press alone can drop a mission from Elite Pacing to System Failure. Log every round the moment you finish it, and aim for a number you could repeat from round one on — that repeatability is the actual skill this measures.',
  },
  pacingClassification: {
    title: 'Pacing rating',
    whatItIs:
      'The label your P.V.I. variance earns — Elite Pacing, Standard, Power Leak, or System Failure.',
    howItsCalculated: 'A direct read of the P.V.I. variance percentage against four bands:',
    whatItMeasures:
      'The same thing P.V.I. variance measures — how even your rounds were — translated into a label and a multiplier you can read at a glance.',
    howToUseIt:
      'Power Leak and System Failure share the same fix: you spent too much in the early rounds and paid for it later. Next time you run that workout, deliberately hold your first two rounds back — that is where most of the damage gets done.',
    table: {
      caption: 'P.V.I. variance → rating',
      rows: pviBandRows((percent) => getPviMultiplier(percent).classification),
    },
  },
};

export function getScoreStatGuidance(
  id: ScoreStatId,
  context: { repsPerRound?: number } = {}
): ScoreStatGuidance {
  if (id === 'baseScore') {
    return baseScoreGuidance(context.repsPerRound);
  }
  return GUIDANCE[id];
}
