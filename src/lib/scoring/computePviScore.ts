import { computePvi } from '@/lib/scoring/computePvi';
import { getPviMultiplier } from '@/lib/scoring/getPviMultiplier';
import type { PviMultiplierResult } from '@/lib/scoring/types';
import type { LiveSessionPhase } from '@/lib/sessionSync/types';

export interface PviScoreResult extends PviMultiplierResult {
  pvi: number | null;
  adjustedScore: number;
}

export function computePviScore(
  roundDurationsSec: number[],
  durationMinutes: number,
  sessionPhase: LiveSessionPhase,
  baseScore: number
): PviScoreResult {
  if (sessionPhase !== 'finished') {
    return {
      pvi: null,
      multiplier: 1.0,
      classification: 'Standard',
      verdict: '',
      adjustedScore: baseScore,
    };
  }

  const pvi = computePvi(roundDurationsSec, {
    excludeFirstRound: durationMinutes >= 10,
  });
  const { multiplier, classification, verdict } = getPviMultiplier(pvi);

  return {
    pvi,
    multiplier,
    classification,
    verdict,
    adjustedScore: Math.round(baseScore * multiplier),
  };
}
