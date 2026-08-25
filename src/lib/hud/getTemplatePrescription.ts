import type { WorkoutTemplate } from '@/data/workoutTemplates';
import type { ClassificationQuotas } from '@/lib/hud/classificationQuotas';
import { compareClassificationRank } from '@/lib/hud/compareClassificationRank';
import type { ClassificationProgress, ClassificationRank } from '@/lib/hud/types';

export type TemplatePrescription =
  | { required: false }
  | { required: true; label: string };

function nextTierFrom(verified: ClassificationRank): ClassificationRank | null {
  if (verified === 'unclassified') {
    return 'civilian';
  }
  if (verified === 'civilian') {
    return 'operator';
  }
  if (verified === 'operator') {
    return 'special_ops';
  }
  return null;
}

function prescribeForTarget(
  template: Pick<WorkoutTemplate, 'intensityTier' | 'durationMinutes'>,
  progress: ClassificationProgress,
  quotas: ClassificationQuotas,
  target: ClassificationRank,
  prefix: 'MANDATE' | 'PROVE IT'
): TemplatePrescription {
  if (target === 'operator') {
    if (
      progress.intensity3PlusCount < quotas.operatorIntensity3Plus &&
      template.intensityTier >= 3
    ) {
      return { required: true, label: `${prefix}: INTENSITY 3+` };
    }
    return { required: false };
  }

  if (target === 'special_ops') {
    if (progress.marathon20Count < 1 && template.durationMinutes === 20) {
      return { required: true, label: `${prefix}: MARATHON` };
    }
    if (progress.intensity4PlusCount < 3 && template.intensityTier >= 4) {
      return { required: true, label: `${prefix}: TIER 4+` };
    }
    return { required: false };
  }

  return { required: false };
}

export function getTemplatePrescription(
  template: Pick<WorkoutTemplate, 'intensityTier' | 'durationMinutes'>,
  verified: ClassificationRank,
  progress: ClassificationProgress,
  quotas: ClassificationQuotas,
  perceived?: ClassificationRank | null
): TemplatePrescription {
  const behind =
    perceived != null && compareClassificationRank(verified, perceived) < 0;
  const target = behind ? perceived : nextTierFrom(verified);
  if (!target) {
    return { required: false };
  }
  return prescribeForTarget(
    template,
    progress,
    quotas,
    target,
    behind ? 'PROVE IT' : 'MANDATE'
  );
}
