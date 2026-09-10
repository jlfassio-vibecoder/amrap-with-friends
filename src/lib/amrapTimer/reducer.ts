import type { AmrapTimerAction, AmrapTimerState } from './types';

export function createInitialState(): AmrapTimerState {
  return {
    phase: 'idle',
    setupDurationSec: 0,
    workDurationSec: 0,
    timeLeftSec: 0,
    isPaused: false,
    workStartedAtMs: null,
    setupStartedAtMs: null,
    pausedAccumMs: 0,
    pausedAtMs: null,
    rounds: [],
  };
}

/**
 * Seconds of work actually done by `nowMs`, pause excluded.
 *
 * This is the whole point of the module. The clock used to be a counter the
 * tick decremented, which meant it measured how many intervals the browser had
 * chosen to run rather than how much time had passed — and browsers throttle
 * background intervals hard. A phone locked mid-workout produced a clock
 * running slow, a mission that overran its cap, and round timestamps short by
 * the drift, which became the splits, which became PVI, which multiplies the
 * final score. Reading the wall clock cannot drift because it is not counting
 * anything.
 */
function workElapsedSec(state: AmrapTimerState, nowMs: number): number {
  if (state.workStartedAtMs === null) {
    return 0;
  }
  const openPauseMs = state.pausedAtMs === null ? 0 : Math.max(0, nowMs - state.pausedAtMs);
  const runningMs = nowMs - state.workStartedAtMs - state.pausedAccumMs - openPauseMs;
  return Math.max(0, Math.floor(runningMs / 1000));
}

export function selectElapsedSec(state: AmrapTimerState): number {
  if (state.phase !== 'work' && state.phase !== 'finished') {
    return 0;
  }

  return Math.max(0, Math.min(state.workDurationSec, state.workDurationSec - state.timeLeftSec));
}

export function selectRoundCount(state: AmrapTimerState): number {
  return state.rounds.length;
}

export function amrapTimerReducer(
  state: AmrapTimerState,
  action: AmrapTimerAction
): AmrapTimerState {
  switch (action.type) {
    case 'start':
      return {
        phase: 'setup',
        setupDurationSec: action.setupDurationSec,
        workDurationSec: action.workDurationSec,
        timeLeftSec: action.setupDurationSec,
        isPaused: false,
        workStartedAtMs: null,
        setupStartedAtMs: action.nowMs,
        pausedAccumMs: 0,
        pausedAtMs: null,
        rounds: [],
      };

    case 'hydrate':
      if (state.phase !== 'idle') {
        return state;
      }
      {
        const isPaused = action.phase === 'work' ? action.isPaused : false;
        // Prefer the real instant work began. Without one, anchor so the clock
        // continues from the time we were handed rather than jumping.
        const workStartedAtMs =
          action.phase === 'work'
            ? (action.workStartedAtMs ??
              action.nowMs - (action.workDurationSec - action.timeLeftSec) * 1000)
            : null;
        return {
          phase: action.phase,
          setupDurationSec: action.setupDurationSec,
          workDurationSec: action.workDurationSec,
          timeLeftSec: action.timeLeftSec,
          isPaused,
          workStartedAtMs,
          setupStartedAtMs:
            action.phase === 'setup'
              ? action.nowMs - (action.setupDurationSec - action.timeLeftSec) * 1000
              : null,
          // Pauses before this client existed are unknowable; the anchor above
          // already accounts for them by matching the clock we were given.
          pausedAccumMs: 0,
          pausedAtMs: isPaused ? action.nowMs : null,
          rounds: [],
        };
      }

    case 'pause':
      if (state.phase !== 'work' || state.isPaused) {
        return state;
      }
      // Freeze on the real clock, not on whatever the last tick left behind: a
      // tick missed just before the pause would otherwise be frozen in too.
      return {
        ...state,
        isPaused: true,
        pausedAtMs: action.nowMs,
        timeLeftSec: Math.max(0, state.workDurationSec - workElapsedSec(state, action.nowMs)),
      };

    case 'resume': {
      if (state.phase !== 'work' || !state.isPaused) {
        return state;
      }
      // The pause is banked here, which is what keeps the wall clock honest
      // across it: time spent paused is time the athlete did not work.
      const bankedMs = state.pausedAtMs === null ? 0 : Math.max(0, action.nowMs - state.pausedAtMs);
      return {
        ...state,
        isPaused: false,
        pausedAccumMs: state.pausedAccumMs + bankedMs,
        pausedAtMs: null,
      };
    }

    case 'finish':
      if (state.phase !== 'work') {
        return state;
      }
      return {
        ...state,
        phase: 'finished',
        timeLeftSec: 0,
        isPaused: false,
      };

    case 'logRound': {
      if (state.phase !== 'work') {
        return state;
      }

      // Read the clock rather than the last tick's leftovers: timeLeftSec is
      // only as fresh as the interval that set it, and a round logged between
      // ticks would otherwise be recorded up to a second early.
      const loggedElapsedSec = Math.min(state.workDurationSec, workElapsedSec(state, action.nowMs));

      // A missed log carries its own reconstructed boundary; an ordinary log
      // takes the clock as it stands.
      const elapsedSecAtRound = action.elapsedSecOverride ?? loggedElapsedSec;

      return {
        ...state,
        rounds: [
          ...state.rounds,
          {
            roundIndex: state.rounds.length,
            elapsedSecAtRound,
            loggedAtMs: action.nowMs,
            missedLogReps: action.missedLogReps ?? null,
          },
        ],
      };
    }

    case 'tick':
      if (state.phase === 'idle' || state.phase === 'finished' || state.isPaused) {
        return state;
      }

      if (state.phase === 'setup') {
        const anchor = state.setupStartedAtMs ?? action.nowMs;
        const remaining = state.setupDurationSec - Math.floor((action.nowMs - anchor) / 1000);
        if (remaining <= 0) {
          // Work begins when the countdown *ended*, not when this tick happened
          // to run. A throttled tab would otherwise start the clock late and
          // hand the athlete extra seconds.
          return {
            ...state,
            phase: 'work',
            timeLeftSec: state.workDurationSec,
            workStartedAtMs: anchor + state.setupDurationSec * 1000,
            setupStartedAtMs: anchor,
          };
        }
        return { ...state, timeLeftSec: remaining, setupStartedAtMs: anchor };
      }

      if (state.phase === 'work') {
        const remaining = state.workDurationSec - workElapsedSec(state, action.nowMs);
        if (remaining <= 0) {
          return {
            ...state,
            phase: 'finished',
            timeLeftSec: 0,
            isPaused: false,
            pausedAtMs: null,
          };
        }
        return { ...state, timeLeftSec: remaining };
      }

      return state;

    case 'reset':
      return createInitialState();

    default:
      return state;
  }
}
