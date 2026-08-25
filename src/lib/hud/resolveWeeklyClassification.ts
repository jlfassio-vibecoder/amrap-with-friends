import type { ClassificationQuotas } from '@/lib/hud/classificationQuotas';
import type { ClassificationProgress, ClassificationRank } from '@/lib/hud/types';

/**
 * Pure twin of SQL weekly classification rules (source of truth remains hud_telemetry).
 * Highest rank meeting all criteria wins. Civilian/Operator quotas scale; Special Ops is absolute.
 */
export function resolveWeeklyClassification(
  progress: ClassificationProgress,
  quotas: ClassificationQuotas
): ClassificationRank {
  const {
    weekMinutes,
    intensity3PlusCount,
    intensity4PlusCount,
    marathon20Count,
  } = progress;

  if (
    weekMinutes >= quotas.specialOpsMinutes &&
    intensity4PlusCount >= quotas.specialOpsIntensity4Plus &&
    marathon20Count >= quotas.specialOpsMarathon20
  ) {
    return 'special_ops';
  }
  if (
    weekMinutes >= quotas.operatorMinutes &&
    intensity3PlusCount >= quotas.operatorIntensity3Plus
  ) {
    return 'operator';
  }
  if (weekMinutes >= quotas.civilianMinutes) {
    return 'civilian';
  }
  return 'unclassified';
}
