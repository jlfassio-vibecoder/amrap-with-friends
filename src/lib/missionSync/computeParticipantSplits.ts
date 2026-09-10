import type { RoundRow } from '@/lib/missionSync/types';

export interface ParticipantSplitEntry {
  roundNumber: number;
  durationSec: number;
  /** True when this round's boundary was reconstructed from a missed log. */
  wasMissedLog: boolean;
}

export function formatSplitDuration(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function computeParticipantSplits(
  rounds: RoundRow[],
  participantId: string,
  segmentIndex: number
): ParticipantSplitEntry[] {
  const participantRounds = rounds
    .filter(
      (round) => round.participant_id === participantId && round.segment_index === segmentIndex
    )
    .sort((a, b) => a.round_index - b.round_index);

  return participantRounds.map((round, index) => {
    const previousElapsed = index > 0 ? participantRounds[index - 1].elapsed_sec_at_round : 0;

    return {
      roundNumber: round.round_index + 1,
      durationSec: Math.max(0, round.elapsed_sec_at_round - previousElapsed),
      wasMissedLog: round.missed_log_reps !== null,
    };
  });
}
