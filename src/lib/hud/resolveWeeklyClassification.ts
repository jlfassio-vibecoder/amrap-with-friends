import type { ClassificationProgress, ClassificationRank } from '@/lib/hud/types';

/**
 * Pure twin of SQL weekly classification rules (source of truth remains hud_telemetry).
 * Highest rank meeting all criteria wins.
 */
export function resolveWeeklyClassification(
  progress: ClassificationProgress
): ClassificationRank {
  const {
    weekMinutes,
    intensity3PlusCount,
    intensity4PlusCount,
    marathon20Count,
  } = progress;

  if (
    weekMinutes >= 300 &&
    intensity4PlusCount >= 3 &&
    marathon20Count >= 1
  ) {
    return 'special_ops';
  }
  if (weekMinutes >= 240 && intensity3PlusCount >= 2) {
    return 'operator';
  }
  if (weekMinutes >= 150) {
    return 'civilian';
  }
  return 'unclassified';
}
