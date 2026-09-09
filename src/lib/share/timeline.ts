import { CUTS, missionTimeAt, phaseAt, type CutId } from '@/lib/share/cuts';
import type { ReplayData, ShareVariant } from '@/lib/share/types';
import { countOf } from '@/lib/units/plural';

export interface FrameBar {
  participantId: string;
  displayName: string;
  rounds: number;
  reps: number;
  rank: number;
  highlight: boolean;
  /** 0..1 of the leader's rounds, for the bar width. */
  progress: number;
  /** 0..1, decays after a round lands. Drives the round-pop flash. */
  flash: number;
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
      progress: 1,
      flash: 0,
    }));
}

const FLASH_DECAY_SECONDS = 0.5;

/**
 * The whole storyboard, as a pure function of (data, videoTime, cut).
 *
 * Determinism is the requirement, not a nicety: the encoder calls this once
 * per frame, and anything derived from render order — a mutable previous
 * frame, a Date.now(), an unstable sort — would make two encodes of the same
 * mission differ. Everything here is computed from the round timestamps.
 */
export function frameAtVideoTime(data: ReplayData, t: number, cutId: CutId): FrameState {
  const cut = CUTS[cutId];
  const cap = data.mission.capSeconds;
  const phase = phaseAt(cut, cap, t);
  const missionSeconds = missionTimeAt(cut, cap, t);

  const rows = data.participants.map((participant) => {
    const rounds = data.rounds.filter((round) => round.participantId === participant.participantId);
    const landed = rounds.filter((round) => round.atSeconds <= missionSeconds);
    const last = landed.length > 0 ? landed[landed.length - 1] : null;
    // Mission seconds since the last round landed, converted to a decaying
    // flash. Derived from the data, so scrubbing backwards looks the same as
    // playing forwards.
    const sinceLast = last ? missionSeconds - last.atSeconds : Number.POSITIVE_INFINITY;
    return {
      participant,
      rounds: landed.length,
      // Reps only exist as a final figure, so they appear when the clock does.
      reps: phase.phase === 'freeze' || missionSeconds >= cap ? participant.finalReps : 0,
      flash: Math.max(0, 1 - sinceLast / FLASH_DECAY_SECONDS),
    };
  });

  const leader = Math.max(1, ...rows.map((row) => row.rounds));

  const bars = rows
    .sort((a, b) => {
      if (b.rounds !== a.rounds) {
        return b.rounds - a.rounds;
      }
      if (b.reps !== a.reps) {
        return b.reps - a.reps;
      }
      return a.participant.displayName.localeCompare(b.participant.displayName);
    })
    .map((row, index) => ({
      participantId: row.participant.participantId,
      displayName: row.participant.displayName,
      rounds: row.rounds,
      reps: row.reps,
      rank: index + 1,
      highlight: row.participant.isMe,
      progress: row.rounds / leader,
      flash: row.flash,
    }));

  const freezeSpan = cut.durationSeconds - (phase.phase === 'freeze' ? phase.from : 0);

  return {
    phase: phase.phase,
    clockSeconds: Math.max(0, Math.min(cap, missionSeconds)),
    bars,
    cardBlend:
      phase.phase === 'freeze' && freezeSpan > 0
        ? Math.max(0, Math.min(1, (t - phase.from) / freezeSpan))
        : 0,
  };
}

/** The card: the last frame of the storyboard, with the board already final. */
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
  const rounds = countOf(bar.rounds, 'round');
  return bar.reps > 0 ? `${rounds} + ${bar.reps}` : rounds;
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
