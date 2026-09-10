import { domainForCap, type MissionTimeCap } from '@/lib/timeDomains';
import type { TimeDomain } from '@/data/workoutTemplates';

/**
 * How long the squad rests between two chained missions.
 *
 * These numbers are a coaching compromise between a mechanism and a product,
 * and it is worth being precise about which parts are which.
 *
 * Phosphocreatine resynthesis is biphasic — a fast component with a half-time
 * around 21 to 30 seconds, a slow component beyond 170 — so the phosphagen
 * system, which is what the opening of the next mission draws on, is largely
 * restored inside three to five minutes. Blood lactate is a different
 * timescale entirely: roughly thirty minutes to clear even at the best active
 * recovery intensity. The interval-training literature's 1:1 to 1:2 work-to-rest
 * would mean a twenty-minute rest after a twenty-minute AMRAP, which nobody in
 * a social mission chain will take.
 *
 * So these rests restore the phosphagen system and let heart rate fall. They do
 * not clear lactate and the product must not imply they do — the second mission
 * of a chain is meant to feel harder than the first.
 *
 * The sourcing for those two timescales has not yet been verified against full
 * texts (see docs/plans/mission-chains.md), which is why none of it appears on
 * a /science page or in scienceReferences.ts.
 */

/** Never rest less than this, whatever the tier adjustment says. */
export const MIN_REST_SEC = 60;

/**
 * `set_rally_point_countdown` refuses more than 600 seconds, and the rest is
 * delivered as that countdown. Sharing the ceiling here means this function can
 * never return a rest the timer cannot carry.
 */
export const MAX_REST_SEC = 600;

/** Long enough for a real session, short enough that the builder stays one screen. */
export const MAX_CHAIN_LENGTH = 5;

const BASE_REST_SEC: Record<TimeDomain, number> = {
  5: 90,
  10: 150,
  15: 210,
  20: 300,
};

export interface ChainMission {
  /** The clock this mission runs, not the domain it belongs to. */
  durationMinutes: MissionTimeCap;
  /**
   * Benchmark Matrix intensity, 1–5. Null for a workout that carries no tier.
   * Typed as a plain number rather than `IntensityTier` because this also
   * arrives from a queue row's `int` column, where the union would be a promise
   * the database does not keep.
   */
  intensityTier?: number | null;
}

function tierAdjustmentSec(intensityTier: number | null | undefined): number {
  if (intensityTier === null || intensityTier === undefined) {
    return 0;
  }
  if (intensityTier >= 4) {
    return 60;
  }
  if (intensityTier <= 2) {
    return -30;
  }
  return 0;
}

/**
 * The rest earned by finishing this mission.
 *
 * Throws on a clock no domain claims. A chain is built from library workouts at
 * legal caps, so an unclaimed minute here is a programming error rather than
 * something to paper over with a guess — the same reason `referencesFor` throws
 * on an unknown id.
 */
export function restAfterMissionSec(mission: ChainMission): number {
  const domain = domainForCap(mission.durationMinutes);
  if (domain === null) {
    throw new Error(
      `No time domain for a ${mission.durationMinutes}-minute mission; chains only run library caps.`
    );
  }

  const rest = BASE_REST_SEC[domain] + tierAdjustmentSec(mission.intensityTier);
  // The clamp is inert against the table as it stands — the range it can
  // produce is 60 to 360, which is exactly the floor and well under the
  // ceiling. It is here so that editing a base or a tier adjustment cannot
  // quietly produce a rest the countdown will refuse to arm.
  return Math.min(Math.max(rest, MIN_REST_SEC), MAX_REST_SEC);
}

export interface ChainStep {
  mission: ChainMission;
  /** Seconds of rest before this mission starts. Always 0 for the first. */
  restBeforeSec: number;
}

/**
 * Rest is derived from the mission before it, never stored.
 *
 * The inputs — the cap and the tier — are already on the queue row, so the
 * answer is fully determined. A stored copy could only ever drift from the
 * workout actually scheduled, which is the same reason campaign roles are
 * derived rather than written down.
 */
export function chainRestPlan(missions: ChainMission[]): ChainStep[] {
  return missions.map((mission, index) => ({
    mission,
    restBeforeSec: index === 0 ? 0 : restAfterMissionSec(missions[index - 1]),
  }));
}

/** Work plus rest, in seconds — what the squad is actually committing to. */
export function chainTotalSec(missions: ChainMission[]): number {
  return chainRestPlan(missions).reduce(
    (total, step) => total + step.restBeforeSec + step.mission.durationMinutes * 60,
    0
  );
}

export interface ChainAdvisory {
  code: 'long-mission-not-last';
  /** Index of the mission the advisory is about. */
  index: number;
  message: string;
}

/**
 * Things worth telling the host about the shape of their chain.
 *
 * Advisory, not enforcement. A Long mission in the middle of a chain is a bad
 * idea for a reason the rest table cannot fix: the longest rest available is six
 * minutes, and lactate after eighteen to twenty-five minutes of work needs
 * roughly thirty. Whatever comes next is run on a body that has not recovered,
 * and the score will say so. But a host who wants to do it anyway is not
 * committing an error the app should refuse — it is their session.
 */
export function chainAdvisories(missions: ChainMission[]): ChainAdvisory[] {
  const advisories: ChainAdvisory[] = [];

  missions.forEach((mission, index) => {
    const isLast = index === missions.length - 1;
    if (isLast || domainForCap(mission.durationMinutes) !== 20) {
      return;
    }
    advisories.push({
      code: 'long-mission-not-last',
      index,
      message:
        'A mission this long is best left until last. The rest after it will not be enough to recover from it, so whatever follows will be run tired.',
    });
  });

  return advisories;
}

/** m:ss, for a rest shown in the builder. */
export function formatRestSec(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, '0')}`;
}
