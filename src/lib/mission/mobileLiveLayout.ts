import type { LiveMissionPhase } from '@/lib/missionSync/types';
import { countOf } from '@/lib/units/plural';

/** Mobile LIVE compaction: hide leaderboard, chat, and mobile footer below `lg`. */
export function hideMobileLiveChrome(phase: LiveMissionPhase): boolean {
  return phase === 'work';
}

/** Athletes review movements before Start — omit How to on mobile LIVE. */
export function shouldOmitMobileLiveHowTo(phase: LiveMissionPhase): boolean {
  return hideMobileLiveChrome(phase);
}

/** Tighter workout card chrome when LIVE and the round has 4+ movements. */
export function shouldDenseMobileLiveWorkout(
  phase: LiveMissionPhase,
  exerciseCount: number
): boolean {
  return hideMobileLiveChrome(phase) && exerciseCount >= 4;
}

/**
 * Same score string the live leaderboard shows for the athlete
 * (reps when the workout has a reps-per-round total, otherwise rounds).
 */
export function formatMobileLiveScoreLabel(
  score: number,
  repsPerRound: number,
  roundCount: number
): string {
  if (repsPerRound > 0) {
    return `${score} reps`;
  }
  return countOf(roundCount, 'round');
}
