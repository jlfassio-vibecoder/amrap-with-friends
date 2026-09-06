import { TIME_DOMAINS, type TimeDomain } from '@/data/workoutTemplates';

/**
 * The range table: one time domain, several legal clocks.
 *
 * A `TimeDomain` is a library bucket — it keys templates, category
 * availability, campaign tracks and the `/amrap-workouts/:duration` hubs, and
 * it stays the four canonical minutes. A `MissionTimeCap` is what the clock
 * actually counts down from, chosen from its domain's range.
 *
 * Every consumer reads this module. A literal minute range written into a
 * component or a scoring function is how the two drift apart, and drift here is
 * expensive: it is what makes a splits chart disagree with a score, or a rank
 * unreachable at a clock the product offers.
 */
export type MissionTimeCap = number;

interface DomainRange {
  /** Inclusive. */
  min: MissionTimeCap;
  /** Inclusive. Long is hard-capped at 25; above that is a later conversation. */
  max: MissionTimeCap;
}

const RANGES: Record<TimeDomain, DomainRange> = {
  5: { min: 3, max: 5 },
  10: { min: 7, max: 10 },
  15: { min: 12, max: 15 },
  20: { min: 18, max: 25 },
};

/** The lowest legal cap in any domain. Ultra-Short's floor. */
export const MIN_TIME_CAP: MissionTimeCap = RANGES[5].min;

/** The highest legal cap in any domain. Long's hard max. */
export const MAX_TIME_CAP: MissionTimeCap = RANGES[20].max;

export function capsForDomain(domain: TimeDomain): MissionTimeCap[] {
  const { min, max } = RANGES[domain];
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}

/**
 * The canonical minute — what the domain means when nobody touches the cap
 * control, and the only cap campaigns use in v1.
 */
export function defaultCapForDomain(domain: TimeDomain): MissionTimeCap {
  return domain;
}

export function isCapInDomain(cap: MissionTimeCap, domain: TimeDomain): boolean {
  const { min, max } = RANGES[domain];
  return Number.isInteger(cap) && cap >= min && cap <= max;
}

/**
 * Which domain a clock belongs to, or null for a minute no domain claims.
 *
 * The gaps (6, 11, 16, 17) are deliberate — the selector never offers them, so
 * an athlete cannot reach one. Coach WODs can still be any length the RPC
 * allows, which is why this returns null rather than snapping to the nearest
 * domain: a 30-minute coach workout is not a Long mission that lost its way.
 */
export function domainForCap(cap: MissionTimeCap): TimeDomain | null {
  return TIME_DOMAINS.find((domain) => isCapInDomain(cap, domain)) ?? null;
}

export function isLegalCap(cap: MissionTimeCap): boolean {
  return domainForCap(cap) !== null;
}

/** Every legal cap, ascending. Useful for exhaustive tests. */
export function allTimeCaps(): MissionTimeCap[] {
  return TIME_DOMAINS.flatMap((domain) => capsForDomain(domain));
}
