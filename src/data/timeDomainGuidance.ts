import { TIME_DOMAINS, type TimeDomain } from '@/data/workoutTemplates';

export type TimeDomainBrandName = 'Sprint' | 'Crucible' | 'Grind' | 'Marathon';

export interface TimeDomainRatings {
  /** Relative calorie burn rate per minute (1–10). */
  fatBurnRate: number;
  /** Local muscle fatigue / pump demand (1–10). */
  muscleStress: number;
  /** Heart and lung demand (1–10). */
  cardio: number;
  /** Relative total session work (1–10). */
  totalWork: number;
}

export interface TimeDomainGuidance {
  brandName: TimeDomainBrandName;
  tagline: string;
  fatBurn: string;
  muscle: string;
  cardio: string;
  feel: string;
  bestFit: string;
  ratings: TimeDomainRatings;
}

/**
 * Chooser guidance for the four time domains — adapted from the Duration
 * Explorer findings. Relative claims only; no absolute calorie ranges.
 */
export const TIME_DOMAIN_GUIDANCE: Record<TimeDomain, TimeDomainGuidance> = {
  5: {
    brandName: 'Sprint',
    tagline: 'All-out burst and local muscle burn',
    fatBurn:
      'High calorie burn rate per minute, but a short clock keeps total session work moderate. Best as a quick metabolic spike when you train often.',
    muscle:
      'Creates intense local fatigue and a fast pump. Builds fatigue-resistant muscle endurance more than heavy strength.',
    cardio:
      'Spikes heart rate to peak effort quickly. Trains short anaerobic bursts and recovery from sudden hard work.',
    feel: 'Feels like a full-out sprint. Acid builds fast — no pacing strategy, just go hard until the clock hits zero.',
    bestFit:
      'Ideal as a high-intensity finisher after another workout, or when you only have a few minutes for a hard sweat.',
    ratings: { fatBurnRate: 6, muscleStress: 9, cardio: 7, totalWork: 5 },
  },
  10: {
    brandName: 'Crucible',
    tagline: 'Peak cardio and calorie burn rate',
    fatBurn:
      'The sweet spot for calorie burn rate: high movement speed held long enough for serious total session work.',
    muscle:
      'Pushes muscle fatigue hard while keeping reps crisp. Builds high-level stamina in classic bodyweight movements.',
    cardio:
      'Premier builder for heart and lung power. Holds you near the redline for a continuous VO2-style effort.',
    feel: 'Breathing gets very heavy. Keep a high work rate, but do not blow out in the first two minutes.',
    bestFit:
      'The top pick when the goal is heart power, lung capacity, and maximizing calorie burn per minute.',
    ratings: { fatBurnRate: 9, muscleStress: 8, cardio: 10, totalWork: 8 },
  },
  15: {
    brandName: 'Grind',
    tagline: 'Aerobic stamina and pacing control',
    fatBurn:
      'High total session calorie burn with a steadier, oxygen-driven pace rather than an all-out sprint rate.',
    muscle:
      'Less about a sharp pump, more about smooth, repeatable output so the muscles keep working without locking up.',
    cardio:
      'Trains the heart and lungs to hold a hard but sustainable pace without crashing — strong general endurance.',
    feel: 'A test of pacing and grit. Set a steady rhythm early so you do not lock up in the middle of the clock.',
    bestFit:
      'Best for building long-distance stamina, race or sport endurance, and mental toughness under fatigue.',
    ratings: { fatBurnRate: 8, muscleStress: 6, cardio: 8, totalWork: 9 },
  },
  20: {
    brandName: 'Marathon',
    tagline: 'Total session work and long-range heart health',
    fatBurn:
      'Highest total session work of the four domains. Operates mainly in a sustained aerobic zone rather than peak burn rate.',
    muscle:
      'Low-to-moderate muscle building effect. The long clock forces pacing, so power per rep drops compared with shorter domains.',
    cardio:
      'Builds long-term cardiovascular capacity — the kind of heart endurance that shows up in daily energy and recovery.',
    feel: 'A true endurance event. Feels like a long effort on bodyweight movements — continuous self-pacing and smooth breathing.',
    bestFit:
      'The top pick for maximum total workout work, long-range heart endurance, and lasting daily energy.',
    ratings: { fatBurnRate: 7, muscleStress: 5, cardio: 8, totalWork: 10 },
  },
};

export function guidanceForDomain(domain: TimeDomain): TimeDomainGuidance {
  return TIME_DOMAIN_GUIDANCE[domain];
}

export function brandNameForDomain(domain: TimeDomain): TimeDomainBrandName {
  return TIME_DOMAIN_GUIDANCE[domain].brandName;
}

/** Stable order matching `TIME_DOMAINS` — for HUD segments and completeness checks. */
export function timeDomainGuidanceEntries(): Array<{
  domain: TimeDomain;
  guidance: TimeDomainGuidance;
}> {
  return TIME_DOMAINS.map((domain) => ({
    domain,
    guidance: TIME_DOMAIN_GUIDANCE[domain],
  }));
}
