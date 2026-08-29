import { computeElapsedSecForLogRound } from './computeElapsedSecForLogRound';
import type { AmrapTimerAction, AmrapTimerState } from './types';

export function createInitialState(): AmrapTimerState {
  return {
    phase: 'idle',
    setupDurationSec: 0,
    workDurationSec: 0,
    timeLeftSec: 0,
    isPaused: false,
    workStartedAtMs: null,
    rounds: [],
  };
}

export function selectElapsedSec(state: AmrapTimerState): number {
  if (state.phase !== 'work' && state.phase !== 'finished') {
    return 0;
  }

  return Math.max(
    0,
    Math.min(state.workDurationSec, state.workDurationSec - state.timeLeftSec)
  );
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
        rounds: [],
      };

    case 'hydrate':
      if (state.phase !== 'idle') {
        return state;
      }
      return {
        phase: action.phase,
        setupDurationSec: action.setupDurationSec,
        workDurationSec: action.workDurationSec,
        timeLeftSec: action.timeLeftSec,
        isPaused: action.phase === 'work' ? action.isPaused : false,
        workStartedAtMs: action.phase === 'work' ? action.workStartedAtMs : null,
        rounds: [],
      };

    case 'pause':
      if (state.phase !== 'work' || state.isPaused) {
        return state;
      }
      return { ...state, isPaused: true };

    case 'resume':
      if (state.phase !== 'work' || !state.isPaused) {
        return state;
      }
      return { ...state, isPaused: false };

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

      const elapsedSecAtRound = computeElapsedSecForLogRound({
        workDurationSec: state.workDurationSec,
        timeLeftSec: state.timeLeftSec,
        phase: state.phase,
        isPaused: state.isPaused,
        workStartedAtMs: state.workStartedAtMs,
        roundCountInWork: state.rounds.length,
        nowMs: action.nowMs,
      });

      return {
        ...state,
        rounds: [
          ...state.rounds,
          {
            roundIndex: state.rounds.length,
            elapsedSecAtRound,
            loggedAtMs: action.nowMs,
          },
        ],
      };
    }

    case 'tick':
      if (
        state.phase === 'idle' ||
        state.phase === 'finished' ||
        state.isPaused
      ) {
        return state;
      }

      if (state.phase === 'setup') {
        if (state.timeLeftSec <= 1) {
          return {
            ...state,
            phase: 'work',
            timeLeftSec: state.workDurationSec,
            workStartedAtMs: action.nowMs,
          };
        }
        return { ...state, timeLeftSec: state.timeLeftSec - 1 };
      }

      if (state.phase === 'work') {
        if (state.timeLeftSec <= 1) {
          return {
            ...state,
            phase: 'finished',
            timeLeftSec: 0,
            isPaused: false,
          };
        }
        return { ...state, timeLeftSec: state.timeLeftSec - 1 };
      }

      return state;

    case 'reset':
      return createInitialState();

    default:
      return state;
  }
}
