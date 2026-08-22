import { describe, it, expect } from 'vitest';
import {
  amrapTimerReducer,
  createInitialState,
  selectElapsedSec,
  selectRoundCount,
} from './reducer';
import type { AmrapTimerState } from './types';

function reduce(state: AmrapTimerState, ...actions: Parameters<typeof amrapTimerReducer>[1][]) {
  return actions.reduce((current, action) => amrapTimerReducer(current, action), state);
}

describe('amrapTimerReducer', () => {
  const setupSec = 3;
  const workSec = 10;
  const started = createInitialState();

  describe('phase transitions', () => {
    it('start moves idle to setup with configured durations', () => {
      const state = amrapTimerReducer(started, {
        type: 'start',
        setupDurationSec: setupSec,
        workDurationSec: workSec,
      });

      expect(state.phase).toBe('setup');
      expect(state.setupDurationSec).toBe(setupSec);
      expect(state.workDurationSec).toBe(workSec);
      expect(state.timeLeftSec).toBe(setupSec);
      expect(state.rounds).toEqual([]);
      expect(state.workStartedAtMs).toBeNull();
    });

    it('ticks through setup into work and sets workStartedAtMs', () => {
      const workStartMs = 1_000_000;
      const state = reduce(
        started,
        { type: 'start', setupDurationSec: setupSec, workDurationSec: workSec },
        { type: 'tick', nowMs: workStartMs - 2_000 },
        { type: 'tick', nowMs: workStartMs - 1_000 },
        { type: 'tick', nowMs: workStartMs }
      );

      expect(state.phase).toBe('work');
      expect(state.timeLeftSec).toBe(workSec);
      expect(state.workStartedAtMs).toBe(workStartMs);
    });

    it('ticks through work into finished on timeout', () => {
      const state = reduce(
        started,
        { type: 'start', setupDurationSec: 1, workDurationSec: 2 },
        { type: 'tick', nowMs: 1_000 },
        { type: 'tick', nowMs: 2_000 },
        { type: 'tick', nowMs: 3_000 },
        { type: 'tick', nowMs: 4_000 }
      );

      expect(state.phase).toBe('finished');
      expect(state.timeLeftSec).toBe(0);
      expect(state.isPaused).toBe(false);
    });

    it('start from finished resets to setup', () => {
      const finished = reduce(
        started,
        { type: 'start', setupDurationSec: 2, workDurationSec: 3 },
        { type: 'tick', nowMs: 1_000 },
        { type: 'tick', nowMs: 2_000 },
        { type: 'tick', nowMs: 3_000 },
        { type: 'tick', nowMs: 4_000 },
        { type: 'tick', nowMs: 5_000 }
      );

      const restarted = amrapTimerReducer(finished, {
        type: 'start',
        setupDurationSec: setupSec,
        workDurationSec: workSec,
      });

      expect(restarted.phase).toBe('setup');
      expect(restarted.timeLeftSec).toBe(setupSec);
      expect(restarted.rounds).toEqual([]);
    });
  });

  describe('pause and resume', () => {
    it('pause stops countdown during work', () => {
      const inWork = reduce(
        started,
        { type: 'start', setupDurationSec: 1, workDurationSec: 5 },
        { type: 'tick', nowMs: 1_000 },
        { type: 'tick', nowMs: 2_000 }
      );

      const paused = amrapTimerReducer(inWork, { type: 'pause' });
      const afterTicks = reduce(
        paused,
        { type: 'tick', nowMs: 3_000 },
        { type: 'tick', nowMs: 4_000 }
      );

      expect(paused.isPaused).toBe(true);
      expect(afterTicks.timeLeftSec).toBe(inWork.timeLeftSec);
      expect(afterTicks.phase).toBe('work');
    });

    it('resume allows countdown to continue', () => {
      const paused = reduce(
        started,
        { type: 'start', setupDurationSec: 1, workDurationSec: 5 },
        { type: 'tick', nowMs: 1_000 },
        { type: 'tick', nowMs: 2_000 },
        { type: 'pause' }
      );

      const resumed = reduce(
        amrapTimerReducer(paused, { type: 'resume' }),
        { type: 'tick', nowMs: 3_000 }
      );

      expect(resumed.isPaused).toBe(false);
      expect(resumed.timeLeftSec).toBe(paused.timeLeftSec - 1);
    });

    it('pause and resume are no-ops outside work', () => {
      const setup = amrapTimerReducer(started, {
        type: 'start',
        setupDurationSec: setupSec,
        workDurationSec: workSec,
      });

      expect(amrapTimerReducer(setup, { type: 'pause' })).toEqual(setup);
      expect(amrapTimerReducer(setup, { type: 'resume' })).toEqual(setup);
    });
  });

  describe('round logging', () => {
    it('logs round during active work with tick-based elapsed', () => {
      const inWork = reduce(
        started,
        { type: 'start', setupDurationSec: 1, workDurationSec: 100 },
        { type: 'tick', nowMs: 1_000 },
        { type: 'tick', nowMs: 2_000 },
        { type: 'tick', nowMs: 3_000 }
      );

      const logged = amrapTimerReducer(inWork, { type: 'logRound', nowMs: 3_000 });

      expect(selectRoundCount(logged)).toBe(1);
      expect(logged.rounds[0]).toEqual({
        roundIndex: 0,
        elapsedSecAtRound: 2,
        loggedAtMs: 3_000,
      });
    });

    it('logs multiple rounds with incrementing roundIndex', () => {
      const inWork = reduce(
        started,
        { type: 'start', setupDurationSec: 1, workDurationSec: 100 },
        { type: 'tick', nowMs: 1_000 },
        { type: 'tick', nowMs: 2_000 }
      );

      const logged = reduce(
        inWork,
        { type: 'logRound', nowMs: 3_000 },
        { type: 'tick', nowMs: 4_000 },
        { type: 'logRound', nowMs: 5_000 }
      );

      expect(logged.rounds).toHaveLength(2);
      expect(logged.rounds[1]?.roundIndex).toBe(1);
      expect(logged.rounds[1]?.elapsedSecAtRound).toBe(2);
    });

    it('uses elapsed-at-pause when logging mid-pause', () => {
      const paused = reduce(
        started,
        { type: 'start', setupDurationSec: 1, workDurationSec: 900 },
        { type: 'tick', nowMs: 1_000 },
        { type: 'tick', nowMs: 2_000 },
        { type: 'tick', nowMs: 3_000 },
        { type: 'tick', nowMs: 4_000 },
        { type: 'pause' }
      );

      const logged = amrapTimerReducer(paused, {
        type: 'logRound',
        nowMs: new Date('2020-01-01T00:10:00.000Z').getTime(),
      });

      expect(logged.rounds[0]?.elapsedSecAtRound).toBe(3);
    });

    it('is a no-op outside work', () => {
      const setup = amrapTimerReducer(started, {
        type: 'start',
        setupDurationSec: setupSec,
        workDurationSec: workSec,
      });

      expect(
        amrapTimerReducer(setup, { type: 'logRound', nowMs: 1_000 })
      ).toEqual(setup);
    });
  });

  describe('finish', () => {
    it('manual finish moves work to finished with zero time left', () => {
      const inWork = reduce(
        started,
        { type: 'start', setupDurationSec: 1, workDurationSec: 60 },
        { type: 'tick', nowMs: 1_000 },
        { type: 'tick', nowMs: 2_000 }
      );

      const finished = amrapTimerReducer(inWork, { type: 'finish' });

      expect(finished.phase).toBe('finished');
      expect(finished.timeLeftSec).toBe(0);
      expect(finished.isPaused).toBe(false);
      expect(selectElapsedSec(finished)).toBe(60);
    });

    it('finish is a no-op outside work', () => {
      const setup = amrapTimerReducer(started, {
        type: 'start',
        setupDurationSec: setupSec,
        workDurationSec: workSec,
      });

      expect(amrapTimerReducer(setup, { type: 'finish' })).toEqual(setup);
    });
  });

  describe('selectors', () => {
    it('selectElapsedSec is zero outside work/finished', () => {
      expect(selectElapsedSec(started)).toBe(0);

      const setup = amrapTimerReducer(started, {
        type: 'start',
        setupDurationSec: setupSec,
        workDurationSec: workSec,
      });
      expect(selectElapsedSec(setup)).toBe(0);
    });

    it('selectElapsedSec tracks work progress', () => {
      const inWork = reduce(
        started,
        { type: 'start', setupDurationSec: 1, workDurationSec: 20 },
        { type: 'tick', nowMs: 1_000 },
        { type: 'tick', nowMs: 2_000 },
        { type: 'tick', nowMs: 3_000 },
        { type: 'tick', nowMs: 4_000 }
      );

      expect(selectElapsedSec(inWork)).toBe(3);
    });
  });
});
