import {
  TIME_DOMAINS,
  WORKOUT_TEMPLATES,
  type TimeDomain,
  type WorkoutTemplate,
} from '@/data/workoutTemplates';
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
};

/** Curated multi-workout launches for the Plan hub. */
export const CHAIN_MISSION_PRESETS: readonly ChainMissionPreset[] = [
  {
    id: 'sprint-triple',
    name: 'Sprint triple',
    blurb: 'Three 5-minute Blood Shunt sprints with short rests between.',
    templateIds: ['the-piston', 'shock-and-awe', 'the-pendulum'],
    domains: [5],
  },
  {
    id: 'blood-shunt-double',
    name: 'Blood Shunt double',
    blurb: 'Two 10-minute Blood Shunt AMRAPs back to back — valve then hemodynamics.',
    templateIds: ['the-valve', 'the-hemodynamic'],
    domains: [10],
  },
  {
    id: 'engine-grind',
    name: 'Engine grind',
    blurb: 'Two 15-minute Engine Room pieces for aerobic volume without a long campaign.',
    templateIds: ['the-pacesetter', 'steady-altitude'],
    domains: [15],
  },
];

/** Curated multi-week campaigns for the Plan hub. */
export const CAMPAIGN_MISSION_PRESETS: readonly CampaignMissionPreset[] = [
  {
    id: 'blood-shunt-4',
    name: '4-week Blood Shunt',
    goal: 'Build anaerobic capacity with a short Blood Shunt block.',
    weekCount: 4,
    tracks: [{ durationMinutes: 10, category: 'blood-shunt' }],
    missionsPerWeek: 3,
    domains: [10],
  },
  {
    id: 'dual-track-8',
    name: '8-week dual track',
    goal: 'Alternate Blood Shunt and Engine Room across an 8-week campaign.',
    weekCount: 8,
    tracks: [
      { durationMinutes: 10, category: 'blood-shunt' },
      { durationMinutes: 15, category: 'engine-room' },
    ],
    missionsPerWeek: 3,
    domains: [10, 15],
  },
  {
    id: 'engine-6',
    name: '6-week Engine Room',
    goal: 'Six weeks of Engine Room volume with a clear start and retest.',
    weekCount: 6,
    tracks: [{ durationMinutes: 15, category: 'engine-room' }],
    missionsPerWeek: 3,
    domains: [15],
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
