import { WORKOUT_TEMPLATES, type TimeDomain } from '@/data/workoutTemplates';
import { domainForCap, type MissionTimeCap } from '@/lib/timeDomains';

/**
 * How many benchmarks an athlete may have running, and which one a new
 * designation would collide with.
 *
 * Two rules, and they bind together:
 *
 * 1. **At most three.** `MAX_CAMPAIGN_TESTS` is already three, and the product
 *    should not hold two opinions about how many tests are in flight at once.
 *    Three is also where the HUD card still reads at a glance, which is the
 *    only reason the card is worth having.
 * 2. **At most one per time domain.** A 5-minute test and a 20-minute test
 *    measure different systems; three benchmarks at 10 minutes are three
 *    correlated numbers dressed up as three signals. There are four domains and
 *    a cap of three, so both rules do work.
 *
 * A benchmark costs training — every retest is a mission spent measuring rather
 * than building — so the cap is the feature, not a limitation of it.
 */

/** See rule 1. Deliberately equal to `MAX_CAMPAIGN_TESTS`. */
export const MAX_ACTIVE_BENCHMARKS = 3;

/**
 * Where a slot's occupant came from.
 *
 * A campaign benchmark counts against the cap: it is a real test on a real
 * cadence, and the training it costs is the same training. Athletes are told
 * which slot the campaign is holding rather than left to wonder where it went.
 */
export type BenchmarkSource = 'personal' | 'campaign';

export interface BenchmarkSlot {
  domain: TimeDomain;
  source: BenchmarkSource;
  /** Library template id. */
  templateId: string;
  /** Campaign name for a campaign slot, so the UI can say which one. */
  campaignName?: string;
}

export type DesignateRefusal =
  | 'not-a-library-template'
  | 'cap-has-no-domain'
  | 'domain-taken-personal'
  | 'domain-taken-campaign'
  | 'at-limit';

export type DesignateVerdict =
  | { ok: true; domain: TimeDomain }
  | { ok: false; reason: DesignateRefusal; blocking?: BenchmarkSlot };

const LIBRARY_TEMPLATE_IDS = new Set(WORKOUT_TEMPLATES.map((template) => template.id));

/**
 * Library templates only, in v1.
 *
 * A coach can edit their own workout underneath a stored benchmark, which is
 * exactly what `benchmarkFingerprints.ts` exists to prevent for the campaign
 * benchmarks — and nothing fingerprints a coach workout. A benchmark whose
 * content can change silently is not a benchmark; it is two different tests
 * wearing one name.
 */
export function isBenchmarkableTemplate(templateId: string | null | undefined): boolean {
  return typeof templateId === 'string' && LIBRARY_TEMPLATE_IDS.has(templateId);
}

/** The occupied domains, campaign slots included, keyed for a direct lookup. */
export function benchmarkOccupancy(
  slots: readonly BenchmarkSlot[]
): Map<TimeDomain, BenchmarkSlot> {
  const occupancy = new Map<TimeDomain, BenchmarkSlot>();
  for (const slot of slots) {
    // First wins, so a caller listing campaign slots first keeps the campaign's
    // claim visible rather than having a personal row paper over it.
    if (!occupancy.has(slot.domain)) {
      occupancy.set(slot.domain, slot);
    }
  }
  return occupancy;
}

export function activeBenchmarkCount(slots: readonly BenchmarkSlot[]): number {
  return benchmarkOccupancy(slots).size;
}

/**
 * Whether this workout at this clock can become a benchmark right now.
 *
 * Returns the blocking slot when there is one, so the UI can name what is in
 * the way — "your 8-week Blood Shunt campaign is testing at 10 minutes" is
 * actionable; "limit reached" is not.
 */
export function canDesignateBenchmark(input: {
  templateId: string | null;
  cap: MissionTimeCap;
  slots: readonly BenchmarkSlot[];
}): DesignateVerdict {
  if (!isBenchmarkableTemplate(input.templateId)) {
    return { ok: false, reason: 'not-a-library-template' };
  }

  const domain = domainForCap(input.cap);
  if (domain === null) {
    // 6, 11, 16 and 17 minutes sit in the gaps between domains. A benchmark
    // needs a domain to hold a slot, so those clocks cannot carry one.
    return { ok: false, reason: 'cap-has-no-domain' };
  }

  const occupancy = benchmarkOccupancy(input.slots);
  const blocking = occupancy.get(domain);
  if (blocking) {
    return {
      ok: false,
      reason: blocking.source === 'campaign' ? 'domain-taken-campaign' : 'domain-taken-personal',
      blocking,
    };
  }

  if (occupancy.size >= MAX_ACTIVE_BENCHMARKS) {
    return { ok: false, reason: 'at-limit' };
  }

  return { ok: true, domain };
}
