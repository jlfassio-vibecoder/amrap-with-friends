import type { ReplayData, ShareVariant } from '@/lib/share/types';

export interface FrameBar {
  participantId: string;
  displayName: string;
  rounds: number;
  reps: number;
  rank: number;
  highlight: boolean;
}

export interface FrameState {
  phase: 'title' | 'race' | 'finish' | 'freeze';
  clockSeconds: number;
  bars: FrameBar[];
  cardBlend: number;
}

/**
 * Ranking, in one place.
 *
 * Deliberately not the app's final score: a card shows rounds + reps, which is
 * what an athlete says out loud, and the score carries PVI and domain
 * weighting that would make the board disagree with its own numbers. Ties
 * break on reps, then on name so the order is stable between renders — an
 * unstable sort would make two renders of the same mission differ, and Phase 2
 * needs `frameAt` to be deterministic to encode video.
 */
export function rankParticipants(data: ReplayData): FrameBar[] {
  return [...data.participants]
    .sort((a, b) => {
      if (b.finalRounds !== a.finalRounds) {
        return b.finalRounds - a.finalRounds;
      }
      if (b.finalReps !== a.finalReps) {
        return b.finalReps - a.finalReps;
      }
      return a.displayName.localeCompare(b.displayName);
    })
    .map((participant, index) => ({
      participantId: participant.participantId,
      displayName: participant.displayName,
      rounds: participant.finalRounds,
      reps: participant.finalReps,
      rank: index + 1,
      highlight: participant.isMe,
    }));
}

/**
 * Phase 1 implements the freeze frame only — the card. `t` is accepted now so
 * Phase 2 can fill in title/race/finish without changing a call site.
 */
export function frameAt(data: ReplayData, t: number = data.mission.capSeconds): FrameState {
  return {
    phase: 'freeze',
    clockSeconds: Math.max(0, Math.min(data.mission.capSeconds, t)),
    bars: rankParticipants(data),
    cardBlend: 1,
  };
}

/** Top five, plus the athlete pinned below if they placed outside it — never dropped from their own card. */
export function boardRows(bars: FrameBar[], limit = 5): FrameBar[] {
  const top = bars.slice(0, limit);
  if (top.some((bar) => bar.highlight)) {
    return top;
  }
  const me = bars.find((bar) => bar.highlight);
  return me ? [...top, me] : top;
}

/** The athlete's own row, which the hero is drawn from. */
export function myBar(bars: FrameBar[]): FrameBar | null {
  return bars.find((bar) => bar.highlight) ?? null;
}

export function formatScore(bar: Pick<FrameBar, 'rounds' | 'reps'>): string {
  return bar.reps > 0 ? `${bar.rounds} rounds + ${bar.reps}` : `${bar.rounds} rounds`;
}

/**
 * Which card to draw. A solo mission has no board worth showing, so `squad`
 * falls back to `result` rather than rendering a one-row leaderboard.
 */
export function resolveVariant(data: ReplayData, requested: ShareVariant): ShareVariant {
  if (requested === 'squad' && data.participants.length < 2) {
    return 'result';
  }
  return requested;
}
