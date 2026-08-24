import { computePvi } from '@/lib/scoring/computePvi';
import { computeFinalScore } from '@/lib/scoring/computeFinalScore';
import { getDomainWeight } from '@/lib/scoring/getDomainWeight';
import { getPviMultiplier } from '@/lib/scoring/getPviMultiplier';
import type { ScoreBreakdown } from '@/lib/scoring/types';
import type { LiveSessionPhase } from '@/lib/sessionSync/types';

export function computeScoreBreakdown(
  roundDurationsSec: number[],
  durationMinutes: number,
  sessionPhase: LiveSessionPhase,
  baseScore: number
): ScoreBreakdown {
  if (sessionPhase !== 'finished') {
    return {
      baseScore,
      pvi: null,
      pviMultiplier: 1.0,
      domainWeight: 1.0,
      finalScore: baseScore,
    };
  }

  const pvi = computePvi(roundDurationsSec, {
    excludeFirstRound: durationMinutes >= 10,
  });
  const { multiplier } = getPviMultiplier(pvi);
  const domainWeight = getDomainWeight(durationMinutes);
  const finalScore = computeFinalScore(baseScore, multiplier, domainWeight);

  return {
    baseScore,
    pvi,
    pviMultiplier: multiplier,
    domainWeight,
    finalScore,
  };
}
