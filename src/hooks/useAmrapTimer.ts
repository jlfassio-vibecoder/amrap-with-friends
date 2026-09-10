import { useCallback, useEffect, useReducer } from 'react';
import {
  amrapTimerReducer,
  createInitialState,
  selectElapsedSec,
  type AmrapRoundLog,
  type AmrapTimerPhase,
} from '@/lib/amrapTimer';

export interface UseAmrapTimerReturn {
  phase: AmrapTimerPhase;
  timeLeftSec: number;
  elapsedSec: number;
  workDurationSec: number;
  setupDurationSec: number;
  isPaused: boolean;
  workStartedAtMs: number | null;
  /** Milliseconds banked in closed pauses this work segment. */
  pausedAccumMs: number;
  rounds: AmrapRoundLog[];
  start: (config: { setupDurationSec: number; workDurationSec: number }) => void;
  hydrate: (config: {
    phase: 'setup' | 'work';
    setupDurationSec: number;
    workDurationSec: number;
    timeLeftSec: number;
    workStartedAtMs: number | null;
    isPaused: boolean;
  }) => void;
  pause: () => void;
  resume: () => void;
  finish: () => void;
  logRound: (missed?: { elapsedSecOverride: number; missedLogReps: number }) => void;
  reset: () => void;
}

export function useAmrapTimer(): UseAmrapTimerReturn {
  const [state, dispatch] = useReducer(amrapTimerReducer, undefined, createInitialState);

  const { phase, isPaused } = state;

  useEffect(() => {
    if ((phase !== 'setup' && phase !== 'work') || isPaused) {
      return;
    }

    const interval = window.setInterval(() => {
      dispatch({ type: 'tick', nowMs: Date.now() });
    }, 1000);

    // Coming back from a backgrounded tab, the next interval could be up to a
    // second away and the clock would show a stale value until then. The tick
    // is idempotent -- it reads the clock rather than advancing anything -- so
    // firing one on return is free and makes the catch-up instant.
    const catchUp = () => dispatch({ type: 'tick', nowMs: Date.now() });
    document.addEventListener('visibilitychange', catchUp);
    window.addEventListener('focus', catchUp);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', catchUp);
      window.removeEventListener('focus', catchUp);
    };
  }, [phase, isPaused]);

  const start = useCallback((config: { setupDurationSec: number; workDurationSec: number }) => {
    dispatch({
      type: 'start',
      nowMs: Date.now(),
      setupDurationSec: config.setupDurationSec,
      workDurationSec: config.workDurationSec,
    });
  }, []);

  const hydrate = useCallback(
    (config: {
      phase: 'setup' | 'work';
      setupDurationSec: number;
      workDurationSec: number;
      timeLeftSec: number;
      workStartedAtMs: number | null;
      isPaused: boolean;
    }) => {
      dispatch({
        type: 'hydrate',
        nowMs: Date.now(),
        phase: config.phase,
        setupDurationSec: config.setupDurationSec,
        workDurationSec: config.workDurationSec,
        timeLeftSec: config.timeLeftSec,
        workStartedAtMs: config.workStartedAtMs,
        isPaused: config.isPaused,
      });
    },
    []
  );

  const pause = useCallback(() => {
    dispatch({ type: 'pause', nowMs: Date.now() });
  }, []);

  const resume = useCallback(() => {
    dispatch({ type: 'resume', nowMs: Date.now() });
  }, []);

  const finish = useCallback(() => {
    dispatch({ type: 'finish' });
  }, []);

  const logRound = useCallback((missed?: { elapsedSecOverride: number; missedLogReps: number }) => {
    dispatch({
      type: 'logRound',
      nowMs: Date.now(),
      elapsedSecOverride: missed?.elapsedSecOverride,
      missedLogReps: missed?.missedLogReps ?? null,
    });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'reset' });
  }, []);

  return {
    phase: state.phase,
    timeLeftSec: state.timeLeftSec,
    elapsedSec: selectElapsedSec(state),
    workDurationSec: state.workDurationSec,
    setupDurationSec: state.setupDurationSec,
    isPaused: state.isPaused,
    workStartedAtMs: state.workStartedAtMs,
    pausedAccumMs: state.pausedAccumMs,
    rounds: state.rounds,
    start,
    hydrate,
    pause,
    resume,
    finish,
    logRound,
    reset,
  };
}
