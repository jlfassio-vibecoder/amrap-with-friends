import type { ScoreBreakdown } from '@/lib/scoring/types';
import type { LeaderboardRoundEntry } from '@/lib/missionSync/types';

export interface ResolvePacingDataInput {
  breakdown?: ScoreBreakdown | null;
  roundCount?: number;
  partialReps?: number;
  liveRounds?: LeaderboardRoundEntry[];
}

export interface ResolvedPacingData {
  roundCount: number;
  partialReps: number;
  roundSplits: number[];
}

export function resolvePacingData(input: ResolvePacingDataInput): ResolvedPacingData | null {
  const partialReps = input.partialReps ?? 0;

  if (
    input.breakdown?.roundSplits &&
    input.breakdown.roundSplits.length > 0 &&
    typeof input.breakdown.roundCount === 'number'
  ) {
    return {
      roundCount: input.breakdown.roundCount,
      partialReps,
      roundSplits: input.breakdown.roundSplits,
    };
  }

  if (input.liveRounds && input.liveRounds.length > 0) {
    return {
      roundCount: input.roundCount ?? input.liveRounds.length,
      partialReps,
      roundSplits: input.liveRounds.map((round) => round.durationSec),
    };
  }

  if (typeof input.roundCount === 'number' && input.roundCount >= 0) {
    return {
      roundCount: input.roundCount,
      partialReps,
      roundSplits: [],
    };
  }

  return null;
}
