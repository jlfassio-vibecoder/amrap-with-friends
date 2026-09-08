import {
  TIME_DOMAINS,
  WORKOUT_TEMPLATES,
  type TimeDomain,
  type WorkoutTemplate,
} from '@/data/workoutTemplates';
import type { FitnessSearchGoalId } from '@/data/fitnessSearchGoals';
import { brandNameForDomain, guidanceForDomain } from '@/data/timeDomainGuidance';
import type { CampaignTrack, CampaignWeekCount } from '@/lib/campaign';
import { MAX_CHAIN_LENGTH } from '@/lib/mission/chainRest';

export type ChainMissionPreset = {
  id: string;
  name: string;
  blurb: string;
  templateIds: string[];
  /** Time domain(s) this pack trains — drives Sprint / Crucible / Grind / Marathon labels. */
  domains: readonly TimeDomain[];
  /** Fitness search goals this pack supports — drives Plan hub Goal/Focus filters. */
  searchGoals: readonly FitnessSearchGoalId[];
};

export type CampaignMissionPreset = {
  id: string;
  name: string;
  goal: string;
  weekCount: CampaignWeekCount;
  tracks: CampaignTrack[];
  /** Passed to `suggestedSlots` at launch. */
  missionsPerWeek: number;
  /** Time domain(s) this pack trains — drives Sprint / Crucible / Grind / Marathon labels. */
  domains: readonly TimeDomain[];
  /** Fitness search goals this pack supports — drives Plan hub Goal/Focus filters. */
  searchGoals: readonly FitnessSearchGoalId[];
};

/** Curated multi-workout launches for the Plan hub. */
export const CHAIN_MISSION_PRESETS: readonly ChainMissionPreset[] = [
  // Sprint (5)
  {
    id: 'sprint-triple',
    name: 'Sprint triple',
    blurb: 'Three 5-minute Blood Shunt sprints with short rests between.',
    templateIds: ['the-piston', 'shock-and-awe', 'the-pendulum'],
    domains: [5],
    searchGoals: ['weight-loss', 'cardio-stamina'],
  },
  {
    id: 'sprint-shunt-double',
    name: 'Flash override',
    blurb: 'Two 5-minute Blood Shunt finishers — flood then override.',
    templateIds: ['flash-flood', 'system-override'],
    domains: [5],
    searchGoals: ['weight-loss', 'cardio-stamina'],
  },
  {
    id: 'sprint-engine-double',
    name: 'Gas and redline',
    blurb: 'Two 5-minute Engine Room bursts for quick aerobic spikes.',
    templateIds: ['the-gas-pedal', 'redline'],
    domains: [5],
    searchGoals: ['weight-loss', 'cardio-stamina'],
  },
  {
    id: 'sprint-trap-double',
    name: 'Acid and delts',
    blurb: 'Two 5-minute Localized Trap pieces for local muscle burn.',
    templateIds: ['the-acid-bath', 'deltoid-demise'],
    domains: [5],
    searchGoals: ['muscle-building', 'strength-power'],
  },
  // Crucible (10)
  {
    id: 'blood-shunt-double',
    name: 'Blood Shunt double',
    blurb: 'Two 10-minute Blood Shunt AMRAPs — valve then hemodynamics.',
    templateIds: ['the-valve', 'the-hemodynamic'],
    domains: [10],
    searchGoals: ['weight-loss', 'cardio-stamina'],
  },
  {
    id: 'crucible-shunt-triple',
    name: 'Tide pressure',
    blurb: 'Three 10-minute Blood Shunt pieces for peak cardio density.',
    templateIds: ['arterial-shift', 'the-regulator', 'high-tide'],
    domains: [10],
    searchGoals: ['weight-loss', 'cardio-stamina'],
  },
  {
    id: 'crucible-engine-double',
    name: 'Locomotive cruise',
    blurb: 'Two 10-minute Engine Room pieces at peak calorie-burn pace.',
    templateIds: ['the-locomotive', 'steady-state'],
    domains: [10],
    searchGoals: ['weight-loss', 'cardio-stamina'],
  },
  {
    id: 'crucible-midline-double',
    name: 'Iron lock',
    blurb: 'Two 10-minute Midline Tension pieces for brace and control.',
    templateIds: ['the-iron-cross', 'static-lock'],
    domains: [10],
    searchGoals: ['abs-spot'],
  },
  // Grind (15)
  {
    id: 'engine-grind',
    name: 'Engine grind',
    blurb: 'Two 15-minute Engine Room pieces for aerobic volume.',
    templateIds: ['the-pacesetter', 'steady-altitude'],
    domains: [15],
    searchGoals: ['cardio-stamina', 'weight-loss'],
  },
  {
    id: 'grind-shunt-double',
    name: 'Long haul shunt',
    blurb: 'Two 15-minute Blood Shunt pieces — circulation under fatigue.',
    templateIds: ['the-long-haul', 'deep-circulation'],
    domains: [15],
    searchGoals: ['cardio-stamina', 'weight-loss'],
  },
  {
    id: 'grind-engine-triple',
    name: 'Cadence threshold',
    blurb: 'Three 15-minute Engine Room pieces for pacing and stamina.',
    templateIds: ['the-rhythmic-grind', 'aerobic-threshold', 'the-cadence'],
    domains: [15],
    searchGoals: ['cardio-stamina'],
  },
  {
    id: 'grind-trap-double',
    name: 'Trinity apex',
    blurb: 'Two 15-minute Localized Trap pieces for sustained local stress.',
    templateIds: ['the-trinity', 'the-apex'],
    domains: [15],
    searchGoals: ['muscle-building', 'strength-power'],
  },
  // Marathon (20)
  {
    id: 'marathon-matrix-double',
    name: 'Pacer horizon',
    blurb: 'Two 20-minute Aerobic Matrix pieces for total session work.',
    templateIds: ['the-pacer', 'the-horizon'],
    domains: [20],
    searchGoals: ['weight-loss', 'cardio-stamina'],
  },
  {
    id: 'marathon-cascade-double',
    name: 'Baseline shift',
    blurb: 'Two 20-minute Four-Point Cascade pieces for long-range output.',
    templateIds: ['the-baseline', 'tactical-shift'],
    domains: [20],
    searchGoals: ['cardio-stamina', 'weight-loss'],
  },
  {
    id: 'marathon-armor-double',
    name: 'Stronghold will',
    blurb: 'Two 20-minute Armor Protocol pieces for durable heart stamina.',
    templateIds: ['the-stronghold', 'iron-will'],
    domains: [20],
    searchGoals: ['muscle-building', 'strength-power', 'cardio-stamina'],
  },
  {
    id: 'marathon-matrix-triple',
    name: 'Horsemen slog',
    blurb: 'Three 20-minute Aerobic Matrix pieces — a true endurance chain.',
    templateIds: ['the-four-horsemen', 'the-long-slog', 'the-gridlock'],
    domains: [20],
    searchGoals: ['cardio-stamina', 'weight-loss'],
  },
];

/** Curated multi-week campaigns for the Plan hub. */
export const CAMPAIGN_MISSION_PRESETS: readonly CampaignMissionPreset[] = [
  // Sprint (5)
  {
    id: 'sprint-shunt-4',
    name: '4-week 5-minute Blood Shunt',
    goal: 'Short anaerobic block for sprint burn and muscle endurance.',
    weekCount: 4,
    tracks: [{ durationMinutes: 5, category: 'blood-shunt' }],
    missionsPerWeek: 3,
    domains: [5],
    searchGoals: ['weight-loss', 'cardio-stamina'],
  },
  {
    id: 'sprint-engine-4',
    name: '4-week 5-minute Engine Room',
    goal: 'Four weeks of 5-minute Engine Room finishers.',
    weekCount: 4,
    tracks: [{ durationMinutes: 5, category: 'engine-room' }],
    missionsPerWeek: 3,
    domains: [5],
    searchGoals: ['weight-loss', 'cardio-stamina'],
  },
  {
    id: 'sprint-shunt-6',
    name: '6-week 5-minute Blood Shunt',
    goal: 'Six weeks to build repeat sprint capacity.',
    weekCount: 6,
    tracks: [{ durationMinutes: 5, category: 'blood-shunt' }],
    missionsPerWeek: 3,
    domains: [5],
    searchGoals: ['weight-loss', 'cardio-stamina'],
  },
  {
    id: 'sprint-trap-2',
    name: '2-week 5-minute Localized Trap',
    goal: 'A quick local-muscle block when you want a short campaign.',
    weekCount: 2,
    tracks: [{ durationMinutes: 5, category: 'localized-trap' }],
    missionsPerWeek: 3,
    domains: [5],
    searchGoals: ['muscle-building', 'strength-power'],
  },
  // Crucible (10)
  {
    id: 'blood-shunt-4',
    name: '4-week 10-minute Blood Shunt',
    goal: 'Peak cardio and calorie burn rate in a short Crucible block.',
    weekCount: 4,
    tracks: [{ durationMinutes: 10, category: 'blood-shunt' }],
    missionsPerWeek: 3,
    domains: [10],
    searchGoals: ['weight-loss', 'cardio-stamina'],
  },
  {
    id: 'crucible-shunt-8',
    name: '8-week 10-minute Blood Shunt',
    goal: 'Eight weeks of 10-minute Blood Shunt heart-power work.',
    weekCount: 8,
    tracks: [{ durationMinutes: 10, category: 'blood-shunt' }],
    missionsPerWeek: 3,
    domains: [10],
    searchGoals: ['weight-loss', 'cardio-stamina'],
  },
  {
    id: 'crucible-engine-6',
    name: '6-week 10-minute Engine Room',
    goal: 'Six weeks at the sweet spot for calorie burn per minute.',
    weekCount: 6,
    tracks: [{ durationMinutes: 10, category: 'engine-room' }],
    missionsPerWeek: 3,
    domains: [10],
    searchGoals: ['weight-loss', 'cardio-stamina'],
  },
  {
    id: 'crucible-midline-4',
    name: '4-week 10-minute Midline Tension',
    goal: 'Four weeks of brace and anti-rotation under a 10-minute clock.',
    weekCount: 4,
    tracks: [{ durationMinutes: 10, category: 'midline-tension' }],
    missionsPerWeek: 3,
    domains: [10],
    searchGoals: ['abs-spot'],
  },
  // Grind (15)
  {
    id: 'engine-6',
    name: '6-week 15-minute Engine Room',
    goal: 'Six weeks of Engine Room pacing and aerobic stamina.',
    weekCount: 6,
    tracks: [{ durationMinutes: 15, category: 'engine-room' }],
    missionsPerWeek: 3,
    domains: [15],
    searchGoals: ['cardio-stamina', 'weight-loss'],
  },
  {
    id: 'grind-engine-8',
    name: '8-week 15-minute Engine Room',
    goal: 'Eight weeks to lock in long-distance stamina.',
    weekCount: 8,
    tracks: [{ durationMinutes: 15, category: 'engine-room' }],
    missionsPerWeek: 3,
    domains: [15],
    searchGoals: ['cardio-stamina'],
  },
  {
    id: 'grind-shunt-4',
    name: '4-week 15-minute Blood Shunt',
    goal: 'A shorter Grind block focused on sustained Blood Shunt output.',
    weekCount: 4,
    tracks: [{ durationMinutes: 15, category: 'blood-shunt' }],
    missionsPerWeek: 3,
    domains: [15],
    searchGoals: ['cardio-stamina', 'weight-loss'],
  },
  {
    id: 'grind-trap-6',
    name: '6-week 15-minute Localized Trap',
    goal: 'Six weeks of local muscle stress under a Grind clock.',
    weekCount: 6,
    tracks: [{ durationMinutes: 15, category: 'localized-trap' }],
    missionsPerWeek: 3,
    domains: [15],
    searchGoals: ['muscle-building', 'strength-power'],
  },
  // Marathon (20)
  {
    id: 'marathon-matrix-8',
    name: '8-week 20-minute Aerobic Matrix',
    goal: 'Maximum total session work and long-range heart endurance.',
    weekCount: 8,
    tracks: [{ durationMinutes: 20, category: 'aerobic-matrix' }],
    missionsPerWeek: 3,
    domains: [20],
    searchGoals: ['weight-loss', 'cardio-stamina'],
  },
  {
    id: 'marathon-cascade-6',
    name: '6-week 20-minute Four-Point Cascade',
    goal: 'Six weeks of cascade volume for durable aerobic capacity.',
    weekCount: 6,
    tracks: [{ durationMinutes: 20, category: 'four-point-cascade' }],
    missionsPerWeek: 3,
    domains: [20],
    searchGoals: ['cardio-stamina', 'weight-loss'],
  },
  {
    id: 'marathon-armor-4',
    name: '4-week 20-minute Armor Protocol',
    goal: 'A short Armor Protocol block for long-clock durability.',
    weekCount: 4,
    tracks: [{ durationMinutes: 20, category: 'armor-protocol' }],
    missionsPerWeek: 3,
    domains: [20],
    searchGoals: ['muscle-building', 'strength-power', 'cardio-stamina'],
  },
  {
    id: 'marathon-matrix-12',
    name: '12-week 20-minute Aerobic Matrix',
    goal: 'A full season of 20-minute Matrix work for lasting energy.',
    weekCount: 12,
    tracks: [{ durationMinutes: 20, category: 'aerobic-matrix' }],
    missionsPerWeek: 3,
    domains: [20],
    searchGoals: ['cardio-stamina', 'weight-loss'],
  },
];

export type PresetCategoryLabel = {
  /** Stable sort key — sorted domain minutes joined with `+`. */
  key: string;
  /** Sprint / Crucible / Grind / Marathon (joined with + when mixed). */
  brandName: string;
  /** Plain-English fitness focus from the Duration Explorer guidance. */
  tagline: string;
};

/** Labels a preset with the product time-domain brands derived from the fitness guide. */
export function presetCategoryLabel(domains: readonly TimeDomain[]): PresetCategoryLabel {
  const ordered = TIME_DOMAINS.filter((domain) => domains.includes(domain));
  const unique = ordered.length > 0 ? ordered : [...domains];
  return {
    key: unique.join('+'),
    brandName: unique.map((domain) => brandNameForDomain(domain)).join(' + '),
    tagline: unique.map((domain) => guidanceForDomain(domain).tagline).join(' · '),
  };
}

export function groupPresetsByCategory<T extends { domains: readonly TimeDomain[] }>(
  presets: readonly T[]
): Array<{ label: PresetCategoryLabel; presets: T[] }> {
  const buckets = new Map<string, { label: PresetCategoryLabel; presets: T[] }>();
  for (const preset of presets) {
    const label = presetCategoryLabel(preset.domains);
    const existing = buckets.get(label.key);
    if (existing) {
      existing.presets.push(preset);
    } else {
      buckets.set(label.key, { label, presets: [preset] });
    }
  }
  return [...buckets.values()].sort((a, b) => {
    const aDomains = a.label.key.split('+').map(Number);
    const bDomains = b.label.key.split('+').map(Number);
    const len = Math.min(aDomains.length, bDomains.length);
    for (let i = 0; i < len; i += 1) {
      const left = aDomains[i]!;
      const right = bDomains[i]!;
      if (left !== right) {
        return left - right;
      }
    }
    return aDomains.length - bDomains.length;
  });
}

export function resolveChainPresetTemplates(
  preset: ChainMissionPreset,
  catalog: readonly WorkoutTemplate[] = WORKOUT_TEMPLATES
): WorkoutTemplate[] {
  if (preset.templateIds.length < 2 || preset.templateIds.length > MAX_CHAIN_LENGTH) {
    throw new Error(`Chain preset ${preset.id} has an invalid length.`);
  }
  const byId = new Map(catalog.map((template) => [template.id, template]));
  return preset.templateIds.map((id) => {
    const template = byId.get(id);
    if (!template) {
      throw new Error(`Chain preset ${preset.id} references unknown template ${id}.`);
    }
    return template;
  });
}
