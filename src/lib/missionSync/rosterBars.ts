import type { ParticipantRosterEntry } from '@/lib/missionSync/buildParticipantRoster';
import type { LeaderboardSortMode } from '@/lib/missionSync/buildParticipantRoster';
import type { LiveMissionPhase } from '@/lib/missionSync/types';

/**
 * How full each athlete's bar is on the live board.
 *
 * The creators mock uses a fixed ceiling of 9 rounds, which works for a
 * scripted demo and not for a real room: a squad past the ceiling would peg
 * every bar full, and one that never reaches it would leave the board looking
 * empty for twelve minutes. The leader is the ceiling instead, so the board
 * always spans its own range and the gap you see is the gap that exists.
 *
 * The discipline board ranks by PVI, where lower is better and the numbers are
 * not a quantity — a bar would draw a race that is not being run — so it gets
 * none.
 */
export function rosterBarPercent(score: number, leaderScore: number): number {
  if (!Number.isFinite(score) || score <= 0) {
    return 0;
  }
  if (!Number.isFinite(leaderScore) || leaderScore <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (score / leaderScore) * 100));
}

/** The number the bar is drawn from: raw work in progress, the real result once locked. */
export function rosterBarScore(entry: ParticipantRosterEntry, phase: LiveMissionPhase): number {
  return phase === 'finished' ? entry.finalScore : entry.baseScore;
}

export function shouldShowRosterBars(sortMode: LeaderboardSortMode): boolean {
  return sortMode === 'absolute';
}

/** The ceiling every bar is measured against. Zero when nobody has scored yet. */
export function rosterLeaderScore(
  roster: ParticipantRosterEntry[],
  phase: LiveMissionPhase
): number {
  return roster.reduce((top, entry) => Math.max(top, rosterBarScore(entry, phase)), 0);
}
