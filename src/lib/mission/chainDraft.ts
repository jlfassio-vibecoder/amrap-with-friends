import type { IntensityTier, TimeDomain, WorkoutTemplate } from '@/data/workoutTemplates';
import type { WorkoutExercise } from '@/lib/api/missionTypes';
import { MAX_CHAIN_LENGTH } from '@/lib/mission/chainRest';
import { domainForCap, type MissionTimeCap } from '@/lib/timeDomains';
import { templateToExercises } from '@/lib/workout/templateToExercises';

/** Local Create-page draft row before `set_mission_chain`. */
export type ChainDraftItem = {
  id: string;
  name: string;
  durationMinutes: MissionTimeCap;
  intensityTier: IntensityTier;
  templateId: string;
  /** Programmed template minute — for TimeCapControl off-template warning. */
  templateCap: MissionTimeCap;
  workout: WorkoutExercise[];
};

export function createChainDraftId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `chain-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Page clock when the template sits in the current domain; otherwise its own cap. */
export function capForChainedTemplate(
  templateDurationMinutes: MissionTimeCap,
  pageClock: MissionTimeCap,
  selectedDomain: TimeDomain
): MissionTimeCap {
  return domainForCap(templateDurationMinutes) === selectedDomain
    ? pageClock
    : templateDurationMinutes;
}

export function templatesInCatalogOrder(
  ids: readonly string[],
  catalog: readonly WorkoutTemplate[]
): WorkoutTemplate[] {
  const idSet = new Set(ids);
  return catalog.filter((template) => idSet.has(template.id));
}

export function templatesInSelectionOrder(
  ids: readonly string[],
  catalog: readonly WorkoutTemplate[]
): WorkoutTemplate[] {
  const byId = new Map(catalog.map((template) => [template.id, template]));
  return ids.flatMap((id) => {
    const template = byId.get(id);
    return template ? [template] : [];
  });
}

export function appendTemplatesToChainDraft(
  current: readonly ChainDraftItem[],
  templates: readonly WorkoutTemplate[],
  pageClock: MissionTimeCap,
  selectedDomain: TimeDomain
): ChainDraftItem[] {
  const slots = MAX_CHAIN_LENGTH - current.length;
  if (slots <= 0) {
    return [...current];
  }

  const accepted = templates.slice(0, slots);
  return [
    ...current,
    ...accepted.map((template) => ({
      id: createChainDraftId(),
      name: template.name,
      durationMinutes: capForChainedTemplate(template.durationMinutes, pageClock, selectedDomain),
      intensityTier: template.intensityTier,
      templateId: template.id,
      templateCap: template.durationMinutes,
      workout: templateToExercises(template),
    })),
  ];
}

/** Click-order chain. A single pick stays off the list so the page clock owns it. */
export function reconcileChainDraft(
  current: readonly ChainDraftItem[],
  templates: readonly WorkoutTemplate[],
  pageClock: MissionTimeCap,
  selectedDomain: TimeDomain
): ChainDraftItem[] {
  if (templates.length < 2) {
    return [];
  }

  const existing = new Map(current.map((item) => [item.templateId, item]));
  const next: ChainDraftItem[] = [];
  for (const template of templates) {
    if (next.length >= MAX_CHAIN_LENGTH) {
      break;
    }
    const prior = existing.get(template.id);
    if (prior) {
      next.push(prior);
      continue;
    }
    const [created] = appendTemplatesToChainDraft([], [template], pageClock, selectedDomain);
    if (created) {
      next.push(created);
    }
  }
  return next;
}
