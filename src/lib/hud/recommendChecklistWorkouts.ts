import type { WorkoutTemplate } from '@/data/workoutTemplates';
import { evaluateLoadImbalance } from '@/lib/hud/evaluateLoadImbalance';
import type { HudDomainMinutes } from '@/lib/hud/types';
import type { TemplateRecoveryLock } from '@/lib/smartRecovery/computeRecoveryLocks';

export type ChecklistWorkoutRecommendation = {
  templateId: string;
  name: string;
  durationMinutes: number;
  intensityTier: number;
  locked: boolean;
};

const DEFAULT_LIMIT = 3;

/**
 * Whether a library template can advance an incomplete checklist row.
 * Matches the lethality predicates in `getTemplatePrescription`.
 */
export function templateMatchesChecklistRow(
  rowId: string,
  template: Pick<WorkoutTemplate, 'intensityTier' | 'durationMinutes'>
): boolean {
  if (
    rowId === 'volume-civilian' ||
    rowId === 'volume-operator' ||
    rowId === 'volume-special-ops'
  ) {
    return true;
  }
  if (rowId === 'i3-plus') {
    return template.intensityTier >= 3;
  }
  if (rowId === 'i4-plus') {
    return template.intensityTier >= 4;
  }
  if (rowId === 'marathon-20') {
    return template.durationMinutes === 20;
  }
  return false;
}

function isVolumeRow(rowId: string): boolean {
  return (
    rowId === 'volume-civilian' ||
    rowId === 'volume-operator' ||
    rowId === 'volume-special-ops'
  );
}

function complementaryScore(
  template: WorkoutTemplate,
  domainMinutes: HudDomainMinutes | null | undefined
): number {
  if (!domainMinutes) {
    return 0;
  }
  const imbalance = evaluateLoadImbalance(domainMinutes);
  if (!imbalance.imbalanced) {
    return 0;
  }

  const domain = template.durationMinutes;
  const coreTotal =
    domainMinutes[5] + domainMinutes[10] + domainMinutes[15] + domainMinutes[20];
  if (coreTotal <= 0) {
    return 0;
  }

  // Prefer underrepresented clocks; push away from the dominant domain.
  if (domain === imbalance.dominant) {
    return -20;
  }
  const share = domainMinutes[domain] / coreTotal;
  return Math.round((1 - share) * 20);
}

/**
 * Rank up to `limit` library workouts for one incomplete checklist requirement.
 * Unlocked (Smart Recovery) candidates win; locked fill only if the unlocked
 * pool is too small. Volume rows also bias toward complementary time domains.
 */
export function recommendChecklistWorkouts(
  rowId: string,
  templates: readonly WorkoutTemplate[],
  locks: ReadonlyMap<string, TemplateRecoveryLock> = new Map(),
  domainMinutes: HudDomainMinutes | null | undefined = null,
  limit: number = DEFAULT_LIMIT
): ChecklistWorkoutRecommendation[] {
  if (limit <= 0) {
    return [];
  }

  const candidates = templates.filter((template) =>
    templateMatchesChecklistRow(rowId, template)
  );
  if (candidates.length === 0) {
    return [];
  }

  const unlocked = candidates.filter((template) => !locks.has(template.id));
  const pool = unlocked.length >= limit ? unlocked : candidates;

  const ranked = [...pool].sort((a, b) => {
    const aLocked = locks.has(a.id);
    const bLocked = locks.has(b.id);
    if (aLocked !== bLocked) {
      return aLocked ? 1 : -1;
    }

    const aScore = isVolumeRow(rowId) ? complementaryScore(a, domainMinutes) : 0;
    const bScore = isVolumeRow(rowId) ? complementaryScore(b, domainMinutes) : 0;
    if (aScore !== bScore) {
      return bScore - aScore;
    }

    return a.id.localeCompare(b.id);
  });

  return ranked.slice(0, limit).map((template) => ({
    templateId: template.id,
    name: template.name,
    durationMinutes: template.durationMinutes,
    intensityTier: template.intensityTier,
    locked: locks.has(template.id),
  }));
}

/**
 * Build recommendations for every unmet checklist row id.
 */
export function recommendWorkoutsForChecklistRows(
  unmetRowIds: readonly string[],
  templates: readonly WorkoutTemplate[],
  locks: ReadonlyMap<string, TemplateRecoveryLock> = new Map(),
  domainMinutes: HudDomainMinutes | null | undefined = null,
  limit: number = DEFAULT_LIMIT
): Record<string, ChecklistWorkoutRecommendation[]> {
  const out: Record<string, ChecklistWorkoutRecommendation[]> = {};
  for (const rowId of unmetRowIds) {
    out[rowId] = recommendChecklistWorkouts(
      rowId,
      templates,
      locks,
      domainMinutes,
      limit
    );
  }
  return out;
}
