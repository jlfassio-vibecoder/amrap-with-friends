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
  rounds: AmrapRoundLog[];
  start: (config: { setupDurationSec: number; workDurationSec: number }) => void;
  pause: () => void;
  resume: () => void;
  finish: () => void;
  logRound: () => void;
}

export function useAmrapTimer(): UseAmrapTimerReturn {
  const [state, dispatch] = useReducer(
    amrapTimerReducer,
    undefined,
    createInitialState
  );

  const { phase, isPaused } = state;

  useEffect(() => {
    if (phase !== 'setup' && phase !== 'work' || isPaused) {
      return;
    }

    const interval = window.setInterval(() => {
      dispatch({ type: 'tick', nowMs: Date.now() });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, isPaused]);

  const start = useCallback(
    (config: { setupDurationSec: number; workDurationSec: number }) => {
      dispatch({
        type: 'start',
        setupDurationSec: config.setupDurationSec,
        workDurationSec: config.workDurationSec,
      });
    },
    []
  );

  const pause = useCallback(() => {
    dispatch({ type: 'pause' });
  }, []);

  const resume = useCallback(() => {
    dispatch({ type: 'resume' });
  }, []);

  const finish = useCallback(() => {
    dispatch({ type: 'finish' });
  }, []);

  const logRound = useCallback(() => {
    dispatch({ type: 'logRound', nowMs: Date.now() });
  }, []);

  return {
    phase: state.phase,
    timeLeftSec: state.timeLeftSec,
    elapsedSec: selectElapsedSec(state),
    workDurationSec: state.workDurationSec,
    setupDurationSec: state.setupDurationSec,
    isPaused: state.isPaused,
    rounds: state.rounds,
    start,
    pause,
    resume,
    finish,
    logRound,
  };
}
