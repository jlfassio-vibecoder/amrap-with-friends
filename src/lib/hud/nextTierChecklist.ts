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

/**
 * Checklist for the next tier (or SPECIAL OPS maintenance when already top).
 */
export function nextTierChecklist(
  current: ClassificationRank,
  progress: ClassificationProgress
): NextTierChecklistRow[] {
  if (current === 'unclassified') {
    return [row('volume-150', 'min', progress.weekMinutes, 150)];
  }

  if (current === 'civilian') {
    return [
      row('volume-240', 'min', progress.weekMinutes, 240),
      row(
        'i3-plus',
        'Intensity 3+',
        progress.intensity3PlusCount,
        2
      ),
    ];
  }

  // operator → special ops, or special_ops maintenance
  return [
    row('volume-300', 'min', progress.weekMinutes, 300),
    row(
      'i4-plus',
      'Intensity 4+',
      progress.intensity4PlusCount,
      3
    ),
    row(
      'marathon-20',
      '20-min Marathon',
      progress.marathon20Count,
      1
    ),
  ];
}
