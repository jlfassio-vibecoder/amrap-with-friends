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

const T0 = 0;
/** Wall-clock ms `n` seconds after the epoch these tests start from. */
const at = (seconds: number) => T0 + seconds * 1000;

describe('amrapTimerReducer', () => {
  const setupSec = 3;
  const workSec = 10;
  const started = createInitialState();

  describe('phase transitions', () => {
    it('start moves idle to setup with configured durations', () => {
      const state = amrapTimerReducer(started, {
        type: 'start',
        nowMs: at(0),
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

    it('hydrate seeds setup or work from idle only', () => {
      const hydrated = amrapTimerReducer(started, {
        type: 'hydrate',
        nowMs: at(0),
        phase: 'work',
        setupDurationSec: setupSec,
        workDurationSec: workSec,
        timeLeftSec: 850,
        workStartedAtMs: 1_000_000,
        isPaused: false,
      });

      expect(hydrated.phase).toBe('work');
      expect(hydrated.timeLeftSec).toBe(850);
      expect(hydrated.workStartedAtMs).toBe(1_000_000);

      const ignored = amrapTimerReducer(hydrated, {
        type: 'hydrate',
        nowMs: at(0),
        phase: 'setup',
        setupDurationSec: setupSec,
        workDurationSec: workSec,
        timeLeftSec: 5,
        workStartedAtMs: null,
        isPaused: false,
      });
      expect(ignored.phase).toBe('work');
      expect(ignored.timeLeftSec).toBe(850);
    });

    it('ticks through setup into work and sets workStartedAtMs', () => {
      const state = reduce(
        started,
        { type: 'start', nowMs: at(0), setupDurationSec: setupSec, workDurationSec: workSec },
        { type: 'tick', nowMs: at(1) },
        { type: 'tick', nowMs: at(2) },
        { type: 'tick', nowMs: at(setupSec) }
      );

      expect(state.phase).toBe('work');
      expect(state.timeLeftSec).toBe(workSec);
      expect(state.workStartedAtMs).toBe(at(setupSec));
    });

    it('starts work when the countdown ended, not when a late tick ran', () => {
      // A backgrounded tab can miss every tick of the countdown. Anchoring work
      // to the tick that happens to notice would hand the athlete the whole
      // missing stretch as extra working time.
      const state = reduce(
        started,
        { type: 'start', nowMs: at(0), setupDurationSec: setupSec, workDurationSec: workSec },
        { type: 'tick', nowMs: at(30) }
      );

      expect(state.phase).toBe('work');
      expect(state.workStartedAtMs).toBe(at(setupSec));
    });

    it('ticks through work into finished on timeout', () => {
      const state = reduce(
        started,
        { type: 'start', nowMs: at(0), setupDurationSec: 1, workDurationSec: 2 },
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
        { type: 'start', nowMs: at(0), setupDurationSec: 2, workDurationSec: 3 },
        { type: 'tick', nowMs: 1_000 },
        { type: 'tick', nowMs: 2_000 },
        { type: 'tick', nowMs: 3_000 },
        { type: 'tick', nowMs: 4_000 },
        { type: 'tick', nowMs: 5_000 }
      );

      const restarted = amrapTimerReducer(finished, {
        type: 'start',
        nowMs: at(0),
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
        { type: 'start', nowMs: at(0), setupDurationSec: 1, workDurationSec: 5 },
        { type: 'tick', nowMs: 1_000 },
        { type: 'tick', nowMs: 2_000 }
      );

      const paused = amrapTimerReducer(inWork, { type: 'pause', nowMs: at(2) });
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
        { type: 'start', nowMs: at(0), setupDurationSec: 1, workDurationSec: 5 },
        { type: 'tick', nowMs: 1_000 },
        { type: 'tick', nowMs: 2_000 },
        { type: 'pause', nowMs: at(2) }
      );

      const resumed = reduce(amrapTimerReducer(paused, { type: 'resume', nowMs: at(2) }), {
        type: 'tick',
        nowMs: 3_000,
      });

      expect(resumed.isPaused).toBe(false);
      expect(resumed.timeLeftSec).toBe(paused.timeLeftSec - 1);
    });

    it('pause and resume are no-ops outside work', () => {
      const setup = amrapTimerReducer(started, {
        type: 'start',
        nowMs: at(0),
        setupDurationSec: setupSec,
        workDurationSec: workSec,
      });

      expect(amrapTimerReducer(setup, { type: 'pause', nowMs: at(0) })).toEqual(setup);
      expect(amrapTimerReducer(setup, { type: 'resume', nowMs: at(0) })).toEqual(setup);
    });
  });

  describe('round logging', () => {
    it('logs round during active work with tick-based elapsed', () => {
      const inWork = reduce(
        started,
        { type: 'start', nowMs: at(0), setupDurationSec: 1, workDurationSec: 100 },
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
        missedLogReps: null,
      });
    });

    it('takes the reconstructed boundary when a missed log supplies one', () => {
      const inWork = reduce(
        started,
        { type: 'start', nowMs: at(0), setupDurationSec: 1, workDurationSec: 100 },
        { type: 'tick', nowMs: 1_000 },
        { type: 'tick', nowMs: 2_000 },
        { type: 'tick', nowMs: 3_000 }
      );

      const logged = amrapTimerReducer(inWork, {
        type: 'logRound',
        nowMs: 3_000,
        elapsedSecOverride: 1,
        missedLogReps: 6,
      });

      expect(logged.rounds[0]).toEqual({
        roundIndex: 0,
        elapsedSecAtRound: 1,
        loggedAtMs: 3_000,
        missedLogReps: 6,
      });
    });

    it('logs multiple rounds with incrementing roundIndex', () => {
      const inWork = reduce(
        started,
        { type: 'start', nowMs: at(0), setupDurationSec: 1, workDurationSec: 100 },
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
      // Work began at 1s and the round was logged at 5s: four seconds of work.
      // The old counter said 2 because two ticks had run, which is the drift
      // this module was rebuilt to remove.
      expect(logged.rounds[1]?.elapsedSecAtRound).toBe(4);
    });

    it('uses elapsed-at-pause when logging mid-pause', () => {
      const paused = reduce(
        started,
        { type: 'start', nowMs: at(0), setupDurationSec: 1, workDurationSec: 900 },
        { type: 'tick', nowMs: 1_000 },
        { type: 'tick', nowMs: 2_000 },
        { type: 'tick', nowMs: 3_000 },
        { type: 'tick', nowMs: 4_000 },
        { type: 'pause', nowMs: at(4) }
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
        nowMs: at(0),
        setupDurationSec: setupSec,
        workDurationSec: workSec,
      });

      expect(amrapTimerReducer(setup, { type: 'logRound', nowMs: 1_000 })).toEqual(setup);
    });
  });

  describe('finish', () => {
    it('manual finish moves work to finished with zero time left', () => {
      const inWork = reduce(
        started,
        { type: 'start', nowMs: at(0), setupDurationSec: 1, workDurationSec: 60 },
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
        nowMs: at(0),
        setupDurationSec: setupSec,
        workDurationSec: workSec,
      });

      expect(amrapTimerReducer(setup, { type: 'finish' })).toEqual(setup);
    });

    it('reset returns idle initial state', () => {
      const inWork = reduce(
        started,
        { type: 'start', nowMs: at(0), setupDurationSec: 1, workDurationSec: 60 },
        { type: 'tick', nowMs: 1_000 },
        { type: 'logRound', nowMs: 2_000 }
      );

      const reset = amrapTimerReducer(inWork, { type: 'reset' });
      expect(reset).toEqual(createInitialState());
    });
  });

  describe('selectors', () => {
    it('selectElapsedSec is zero outside work/finished', () => {
      expect(selectElapsedSec(started)).toBe(0);

      const setup = amrapTimerReducer(started, {
        type: 'start',
        nowMs: at(0),
        setupDurationSec: setupSec,
        workDurationSec: workSec,
      });
      expect(selectElapsedSec(setup)).toBe(0);
    });

    it('selectElapsedSec tracks work progress', () => {
      const inWork = reduce(
        started,
        { type: 'start', nowMs: at(0), setupDurationSec: 1, workDurationSec: 20 },
        { type: 'tick', nowMs: 1_000 },
        { type: 'tick', nowMs: 2_000 },
        { type: 'tick', nowMs: 3_000 },
        { type: 'tick', nowMs: 4_000 }
      );

      expect(selectElapsedSec(inWork)).toBe(3);
    });
  });

  describe('the clock does not drift when ticks are missed', () => {
    it('reads the time that passed, not the number of ticks that ran', () => {
      // The bug this module was rebuilt for: browsers throttle background
      // intervals, so a locked phone runs a handful of ticks over minutes. The
      // old counter reported one second per tick -- a five minute AMRAP ran six
      // and a half and never ended.
      const state = reduce(
        started,
        { type: 'start', nowMs: at(0), setupDurationSec: 0, workDurationSec: 300 },
        { type: 'tick', nowMs: at(0) },
        // One tick, two minutes later. Under the counter this was 1 second.
        { type: 'tick', nowMs: at(120) }
      );

      expect(state.phase).toBe('work');
      expect(state.timeLeftSec).toBe(180);
      expect(selectElapsedSec(state)).toBe(120);
    });

    it('finishes on time even when no tick ran near the cap', () => {
      const state = reduce(
        started,
        { type: 'start', nowMs: at(0), setupDurationSec: 0, workDurationSec: 300 },
        { type: 'tick', nowMs: at(0) },
        { type: 'tick', nowMs: at(600) }
      );

      expect(state.phase).toBe('finished');
      expect(state.timeLeftSec).toBe(0);
    });

    it('stamps a round with the time that passed, not the ticks that ran', () => {
      // These become the round splits, which become PVI, which multiplies the
      // final score. Drift here is a wrong score, silently.
      const state = reduce(
        started,
        { type: 'start', nowMs: at(0), setupDurationSec: 0, workDurationSec: 300 },
        { type: 'tick', nowMs: at(0) },
        { type: 'logRound', nowMs: at(95) }
      );

      expect(state.rounds[0]?.elapsedSecAtRound).toBe(95);
    });

    it('does not count a pause as work, however long the tab slept', () => {
      const state = reduce(
        started,
        { type: 'start', nowMs: at(0), setupDurationSec: 0, workDurationSec: 300 },
        { type: 'tick', nowMs: at(0) },
        { type: 'pause', nowMs: at(10) },
        { type: 'resume', nowMs: at(70) },
        { type: 'tick', nowMs: at(80) }
      );

      // 80 seconds of wall time, 60 of them paused.
      expect(selectElapsedSec(state)).toBe(20);
      expect(state.timeLeftSec).toBe(280);
    });

    it('holds the clock still across an open pause', () => {
      const state = reduce(
        started,
        { type: 'start', nowMs: at(0), setupDurationSec: 0, workDurationSec: 300 },
        { type: 'tick', nowMs: at(0) },
        { type: 'pause', nowMs: at(10) },
        { type: 'tick', nowMs: at(400) }
      );

      expect(state.phase).toBe('work');
      expect(selectElapsedSec(state)).toBe(10);
    });
  });
});
