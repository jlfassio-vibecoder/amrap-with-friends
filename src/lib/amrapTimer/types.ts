/** Countdown phases for the local AMRAP clock */
export type AmrapTimerPhase = 'idle' | 'setup' | 'work' | 'finished';

export interface AmrapRoundLog {
  /** 0-based index within this work segment */
  roundIndex: number;
  /** Cumulative seconds into work when logged (pause-aware) */
  elapsedSecAtRound: number;
  /** Wall-clock ms when the round was logged (for display/debug) */
  loggedAtMs: number;
  /** Reps into the next round when a missed log was reconstructed; null when logged live. */
  missedLogReps: number | null;
}

export interface AmrapTimerState {
  phase: AmrapTimerPhase;
  /** Config copied in on start (stable for derived elapsed) */
  setupDurationSec: number;
  workDurationSec: number;
  /** Countdown for current phase (setup or work); 0 in idle/finished */
  timeLeftSec: number;
  isPaused: boolean;
  /** Set when setup completes → work. The anchor the work clock is measured from. */
  workStartedAtMs: number | null;
  /** Set on start. The anchor the setup countdown is measured from. */
  setupStartedAtMs: number | null;
  /** Milliseconds spent paused during this work segment, excluding any pause still open. */
  pausedAccumMs: number;
  /** When the open pause began, or null when running. */
  pausedAtMs: number | null;
  rounds: AmrapRoundLog[];
}

export type AmrapTimerAction =
  | {
      type: 'start';
      nowMs: number;
      setupDurationSec: number;
      workDurationSec: number;
    }
  | {
      type: 'hydrate';
      nowMs: number;
      phase: 'setup' | 'work';
      setupDurationSec: number;
      workDurationSec: number;
      timeLeftSec: number;
      workStartedAtMs: number | null;
      isPaused: boolean;
    }
  | { type: 'tick'; nowMs: number }
  | { type: 'pause'; nowMs: number }
  | { type: 'resume'; nowMs: number }
  | { type: 'finish' }
  | {
      type: 'logRound';
      nowMs: number;
      /** Reconstructed boundary for a missed log; omitted for an ordinary log. */
      elapsedSecOverride?: number;
      missedLogReps?: number | null;
    }
  | { type: 'reset' };
