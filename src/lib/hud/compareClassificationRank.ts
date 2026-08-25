import type { ClassificationRank } from '@/lib/hud/types';

export type PerceivedClassification = 'civilian' | 'operator' | 'special_ops';

const RANK_ORDINAL: Record<ClassificationRank, number> = {
  unclassified: 0,
  civilian: 1,
  operator: 2,
  special_ops: 3,
};

export function classificationRankOrdinal(rank: ClassificationRank): number {
  return RANK_ORDINAL[rank];
}

/** Negative if `a` is below `b`, 0 if equal, positive if `a` is above `b`. */
export function compareClassificationRank(
  a: ClassificationRank,
  b: ClassificationRank
): number {
  return RANK_ORDINAL[a] - RANK_ORDINAL[b];
}

export function canSetPerceivedClassification(
  stored: PerceivedClassification | null,
  next: PerceivedClassification
): boolean {
  if (stored === null) {
    return true;
  }
  return compareClassificationRank(next, stored) >= 0;
}
