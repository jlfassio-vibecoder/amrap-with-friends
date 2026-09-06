export interface OvertrainingInput {
  acuteLoad7d: number;
  chronicWeeklyLoad28d: number;
  consecutiveHighIntensityDays: number;
  /** Minutes trained in the last 7 days. */
  acuteMinutes7d?: number;
  /** The athlete's typical week in minutes, over the observed window. */
  chronicWeeklyMinutes28d?: number;
  /** Days of history the account could have, capped at 28. */
  observedDays?: number;
}

export type OvertrainingRiskLevel = 'normal' | 'building' | 'elevated' | 'high';

export interface OvertrainingGuidance {
  /** What is happening, in one line. */
  headline: string;
  /** Why it fired, in this athlete's own numbers. */
  because: string;
  /**
   * The next action. Always a lighter mission, never a day off — an athlete who
   * stops training drops the chronic baseline that caused the warning, which
   * makes the next week's ratio worse. Lower the intensity, keep the habit.
   */
  doThis: string;
}

export interface OvertrainingResult {
  acwr: number | null;
  riskLevel: OvertrainingRiskLevel;
  guidance: OvertrainingGuidance[];
  /** True while the baseline is still forming — the first four weeks. */
  isLearningBaseline: boolean;
  /** Days of history behind the numbers, out of the 28 the window wants. */
  observedDays: number;
}

/** The window the chronic baseline is measured over. */
export const BASELINE_WINDOW_DAYS = 28;

const ACWR_ELEVATED_THRESHOLD = 1.5;
const ACWR_HIGH_THRESHOLD = 2.0;
const REST_DAY_CONSECUTIVE_THRESHOLD = 5;

/**
 * Below this chronic weekly load, the ratio is not evaluated for risk.
 *
 * Load is minutes × intensity, so 240 is 120 minutes at the default tier 2 —
 * 120 being the lowest weekly civilian quota in `classificationQuotas`. The
 * floor exists because ACWR is a ratio, and a ratio with a near-zero
 * denominator says nothing about the numerator.
 *
 * Worked through, the coupled formula makes this concrete. Chronic weekly is
 * the 28-day total ÷ 4, and the 28-day window *contains* the 7-day window, so
 * with A = the last 7 days and P = the three weeks before them:
 *
 *     ACWR = A ÷ ((A + P) / 4) = 4A / (A + P)
 *
 * which means "high risk" (> 2.0) is exactly `A > P`, and "elevated" (> 1.5) is
 * exactly `A > 0.6P`. Anyone returning from two light weeks trips it on their
 * first ordinary week. Someone training 70 minutes off a near-empty month trips
 * it at a volume no definition of overtraining would recognise — and telling
 * them to scale back is the opposite of what they need.
 *
 * Note that un-coupling the ratio (A ÷ P/3), which is the statistically
 * cleaner form, makes that case *worse*, not better. The problem is the
 * absolute load, not the algebra, which is why this is a floor and not a
 * different formula.
 */
export const MIN_CHRONIC_WEEKLY_LOAD_FOR_RATIO = 240;

function buildingGuidance(): OvertrainingGuidance {
  return {
    headline: 'You are building a base, not overtraining.',
    because:
      'Your last 7 days carried more load than the three weeks before them, but your typical week is still light. A ratio needs a settled baseline before it means anything, so this reads as a ramp rather than a risk.',
    doThis:
      'Keep training. Add minutes before you add intensity — a couple more Foundational (intensity 2) missions a week raises the baseline without spiking it.',
  };
}

function elevatedGuidance(acwr: number, isLearningBaseline: boolean): OvertrainingGuidance {
  return {
    headline: 'You are adding load faster than your body has adapted to.',
    because: `This week came in at ${acwr.toFixed(1)}× your typical week, counting intensity as well as minutes.${
      isLearningBaseline
        ? ''
        : ' Past 1.5× means the last 7 days carried more than 60% of the load of the three weeks before them combined.'
    }`,
    doThis:
      'Make your next mission Active Recovery or Foundational (intensity 1–2), any duration. Keep the frequency, drop the effort — that lets your baseline catch up instead of stalling it.',
  };
}

function highGuidance(acwr: number, isLearningBaseline: boolean): OvertrainingGuidance {
  return {
    headline: 'You jumped your training load hard this week.',
    because: `This week came in at ${acwr.toFixed(1)}× your typical week, counting intensity as well as minutes.${
      isLearningBaseline
        ? ''
        : ' Past 2× means the last 7 days carried more load than the entire three weeks before them.'
    }`,
    doThis:
      'Make your next two missions Active Recovery (intensity 1), any duration. Do not stop training — a week off lowers the baseline that triggered this and makes the next jump sharper. Move easy and let the ratio settle.',
  };
}

function consecutiveDaysGuidance(days: number): OvertrainingGuidance {
  return {
    headline: `${days} hard days in a row.`,
    because:
      'This is a separate signal from load. Five or more consecutive high-intensity days is about not recovering between efforts, whatever the weekly totals say.',
    doThis:
      'Make your next mission Active Recovery (intensity 1), any duration. Keep moving — it is the intensity that needs the break, not the training.',
  };
}

function learningGuidance(observedDays: number): OvertrainingGuidance {
  const remainingDays = Math.max(1, BASELINE_WINDOW_DAYS - observedDays);
  let remainingCopy: string;
  if (remainingDays < 7) {
    remainingCopy = `Another ${remainingDays} day${remainingDays === 1 ? '' : 's'}`;
  } else {
    const remainingWeeks = Math.ceil(remainingDays / 7);
    remainingCopy = `Another ${remainingWeeks} week${remainingWeeks === 1 ? '' : 's'}`;
  }
  return {
    headline: `Still learning what a normal week looks like for you.`,
    because: `These numbers are built from ${observedDays} day${observedDays === 1 ? '' : 's'} of history, not the full four weeks. Until about ${BASELINE_WINDOW_DAYS} days in, one hard week moves your average enough that the comparison swings on its own.`,
    doThis: `Train the way you intend to keep training. ${remainingCopy} of that and this starts telling you something you can act on.`,
  };
}

export function evaluateOvertrainingRisk(input: OvertrainingInput): OvertrainingResult {
  // A zero or missing value means the payload predates the observed-window
  // migration, not that the athlete has no history — defaulting the other way
  // would mark every existing account as still learning.
  const observedDays =
    input.observedDays && input.observedDays > 0 ? input.observedDays : BASELINE_WINDOW_DAYS;
  const isLearningBaseline = observedDays < BASELINE_WINDOW_DAYS;
  // chronicWeeklyLoad28d is a 4-week average that already includes the
  // trailing 7 days, so on its own it can't tell a real baseline apart
  // from "all of this athlete's history is this week." Require some load
  // to exist outside the acute window too — otherwise a single mission
  // with no training before it can look like a huge acute:chronic spike.
  const totalLoad28d = input.chronicWeeklyLoad28d * 4;
  const priorPeriodLoad = totalLoad28d - input.acuteLoad7d;
  const hasBaseline = input.chronicWeeklyLoad28d > 0 && priorPeriodLoad > 0;

  const acwr = hasBaseline
    ? Math.round((input.acuteLoad7d / input.chronicWeeklyLoad28d) * 100) / 100
    : null;

  const ratioIsMeaningful =
    acwr !== null && input.chronicWeeklyLoad28d >= MIN_CHRONIC_WEEKLY_LOAD_FOR_RATIO;

  const guidance: OvertrainingGuidance[] = [];

  let acwrRisk: OvertrainingRiskLevel = 'normal';
  if (acwr !== null && acwr > ACWR_ELEVATED_THRESHOLD) {
    if (!ratioIsMeaningful) {
      // The ratio would have warned, but the baseline it is measured against is
      // too small to carry the claim. Say what is actually happening instead of
      // telling someone below their own weekly target to train less.
      acwrRisk = 'building';
      guidance.push(buildingGuidance());
    } else if (acwr > ACWR_HIGH_THRESHOLD) {
      acwrRisk = 'high';
      guidance.push(highGuidance(acwr, isLearningBaseline));
    } else {
      acwrRisk = 'elevated';
      guidance.push(elevatedGuidance(acwr, isLearningBaseline));
    }
  }

  const restDayTriggered = input.consecutiveHighIntensityDays >= REST_DAY_CONSECUTIVE_THRESHOLD;
  if (restDayTriggered) {
    guidance.push(consecutiveDaysGuidance(input.consecutiveHighIntensityDays));
  }

  let riskLevel: OvertrainingRiskLevel = acwrRisk;
  // Consecutive hard days stand on their own — they are a recovery signal, not a
  // volume one, so they escalate a quiet week but never soften a loud one. It
  // needs no baseline, so it is the one signal that survives the ramp window
  // intact.
  if (restDayTriggered && (riskLevel === 'normal' || riskLevel === 'building')) {
    riskLevel = 'elevated';
  }

  // The first four weeks. A ratio measured over nine days swings on a single
  // session, so it is never allowed to reach 'high' — under-warning here is the
  // safe direction, because the cost of a missed warning is one hard week and
  // the cost of a false one is an athlete who stops trusting the card.
  if (isLearningBaseline) {
    if (riskLevel === 'high') {
      riskLevel = 'elevated';
    }
    guidance.push(learningGuidance(observedDays));
  }

  return { acwr, riskLevel, guidance, isLearningBaseline, observedDays };
}
