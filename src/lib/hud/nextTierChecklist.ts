import type { ClassificationQuotas } from '@/lib/hud/classificationQuotas';
import type { ClassificationProgress, ClassificationRank } from '@/lib/hud/types';

export type NextTierChecklistRow = {
  id: string;
  label: string;
  current: number;
  required: number;
  met: boolean;
};

function row(
  id: string,
  label: string,
  current: number,
  required: number
): NextTierChecklistRow {
  return {
    id,
    label,
    current,
    required,
    met: current >= required,
  };
}

function rowsForTarget(
  target: ClassificationRank,
  progress: ClassificationProgress,
  quotas: ClassificationQuotas
): NextTierChecklistRow[] {
  if (target === 'civilian' || target === 'unclassified') {
    return [
      row('volume-civilian', 'min', progress.weekMinutes, quotas.civilianMinutes),
    ];
  }

  if (target === 'operator') {
    return [
      row(
        'volume-operator',
        'min',
        progress.weekMinutes,
        quotas.operatorMinutes
      ),
      row(
        'i3-plus',
        'Intensity 3+',
        progress.intensity3PlusCount,
        quotas.operatorIntensity3Plus
      ),
    ];
  }

  return [
    row(
      'volume-special-ops',
      'min',
      progress.weekMinutes,
      quotas.specialOpsMinutes
    ),
    row(
      'i4-plus',
      'Intensity 4+',
      progress.intensity4PlusCount,
      quotas.specialOpsIntensity4Plus
    ),
    row(
      'marathon-20',
      '20-min Marathon',
      progress.marathon20Count,
      quotas.specialOpsMarathon20
    ),
  ];
}

function nextTierFrom(current: ClassificationRank): ClassificationRank {
  if (current === 'unclassified') {
    return 'civilian';
  }
  if (current === 'civilian') {
    return 'operator';
  }
  return 'special_ops';
}

export function checklistTarget(
  current: ClassificationRank,
  target?: ClassificationRank
): ClassificationRank {
  return target ?? nextTierFrom(current);
}

/**
 * Checklist for the next tier, or for an explicit target (claimed rank when behind).
 */
export function nextTierChecklist(
  current: ClassificationRank,
  progress: ClassificationProgress,
  quotas: ClassificationQuotas,
  target?: ClassificationRank
): NextTierChecklistRow[] {
  return rowsForTarget(checklistTarget(current, target), progress, quotas);
}
