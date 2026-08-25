import type { WorkoutTemplate } from '@/data/workoutTemplates';
import type { ClassificationProgress, ClassificationRank } from '@/lib/hud/types';

export type TemplatePrescription =
  | { required: false }
  | { required: true; label: string };

export function getTemplatePrescription(
  template: Pick<WorkoutTemplate, 'intensityTier' | 'durationMinutes'>,
  current: ClassificationRank,
  progress: ClassificationProgress
): TemplatePrescription {
  if (current === 'civilian') {
    if (progress.intensity3PlusCount < 2 && template.intensityTier >= 3) {
      return { required: true, label: 'MANDATE: INTENSITY 3+' };
    }
    return { required: false };
  }

  if (current === 'operator') {
    if (progress.marathon20Count < 1 && template.durationMinutes === 20) {
      return { required: true, label: 'MANDATE: MARATHON' };
    }
    if (progress.intensity4PlusCount < 3 && template.intensityTier >= 4) {
      return { required: true, label: 'MANDATE: TIER 4+' };
    }
    return { required: false };
  }

  return { required: false };
}
