import { describe, expect, it } from 'vitest';
import {
  MAX_RATIO,
  OPTIMAL_CEILING,
  benchmarkFromSplits,
  computePacingGaugeState,
  formatPacingReadout,
  pacingReadoutLabel,
  zoneForRatio,
} from '@/lib/pacing/pacingGauge';

describe('benchmarkFromSplits', () => {
  it('is round one’s duration, which is its cumulative split', () => {
    expect(benchmarkFromSplits([45, 95, 148])).toBe(45);
  });

  it('is null before round one is logged', () => {
    expect(benchmarkFromSplits([])).toBeNull();
  });

  it('refuses a zero-length opening round', () => {
    // A double-tap at the buzzer would otherwise make every later ratio
    // infinite and pin the needle to the end of the dial for the whole mission.
    expect(benchmarkFromSplits([0, 40])).toBeNull();
  });
});

describe('zoneForRatio', () => {
  it('is optimal below the ceiling', () => {
    expect(zoneForRatio(0)).toBe('optimal');
    expect(zoneForRatio(OPTIMAL_CEILING - 0.01)).toBe('optimal');
  });

  it('warns from the ceiling up to the benchmark itself', () => {
    expect(zoneForRatio(OPTIMAL_CEILING)).toBe('warning');
    expect(zoneForRatio(1)).toBe('warning');
  });

  it('is overtime only past the benchmark', () => {
    // Exactly on the benchmark is not yet overtime — the athlete matched it.
    expect(zoneForRatio(1.0001)).toBe('overtime');
  });
});

describe('computePacingGaugeState', () => {
  it('is inactive until round one sets the benchmark', () => {
    const state = computePacingGaugeState({ roundSplitsSec: [], elapsedSec: 30 });
    expect(state.isActive).toBe(false);
    expect(state.benchmarkSec).toBeNull();
    // Still counts the opening round's own elapsed time, for the readout.
    expect(state.roundElapsedSec).toBe(30);
  });

  it('measures the current round from the last split, not from zero', () => {
    const state = computePacingGaugeState({ roundSplitsSec: [45, 95], elapsedSec: 120 });
    expect(state.roundElapsedSec).toBe(25);
    expect(state.benchmarkSec).toBe(45);
  });

  it('resets to zero the instant a round is logged', () => {
    // The tap that writes the split is the same tap that restarts the gauge.
    const state = computePacingGaugeState({ roundSplitsSec: [45, 95], elapsedSec: 95 });
    expect(state.roundElapsedSec).toBe(0);
    expect(state.ratio).toBe(0);
    expect(state.zone).toBe('optimal');
  });

  it('crosses into warning at nine tenths of the benchmark', () => {
    const state = computePacingGaugeState({ roundSplitsSec: [100], elapsedSec: 190 });
    expect(state.ratio).toBeCloseTo(0.9);
    expect(state.zone).toBe('warning');
    expect(state.overtimeSec).toBe(0);
  });

  it('counts overtime in whole seconds past the benchmark', () => {
    const state = computePacingGaugeState({ roundSplitsSec: [45], elapsedSec: 95 });
    expect(state.zone).toBe('overtime');
    expect(state.overtimeSec).toBe(5);
  });

  it('stops the needle at the end of the dial but not the counter', () => {
    // A two-minute stall on a 45-second benchmark: the needle has nowhere left
    // to go, so the number carries the truth.
    const state = computePacingGaugeState({ roundSplitsSec: [45], elapsedSec: 165 });
    expect(state.ratio).toBe(MAX_RATIO);
    expect(state.overtimeSec).toBe(75);
  });

  it('never reads a round as starting in the future', () => {
    // A joiner's round can arrive over realtime a tick before their own clock
    // catches up to it.
    const state = computePacingGaugeState({ roundSplitsSec: [45, 95], elapsedSec: 94 });
    expect(state.roundElapsedSec).toBe(0);
  });

  it('keeps round one’s benchmark for the whole mission', () => {
    // Twenty minutes and nineteen rounds later, the benchmark is still round
    // one — not the previous round, and not a rolling average.
    const splits = [45];
    for (let round = 1; round < 19; round += 1) {
      splits.push(splits[splits.length - 1] + 60 + round);
    }
    const state = computePacingGaugeState({ roundSplitsSec: splits, elapsedSec: 1200 });
    expect(state.benchmarkSec).toBe(45);
  });
});

describe('the readout', () => {
  it('counts down the time left in the round', () => {
    const state = computePacingGaugeState({ roundSplitsSec: [90], elapsedSec: 155 });
    expect(formatPacingReadout(state)).toBe('0:25');
    expect(pacingReadoutLabel(state)).toBe('left of round 1');
  });

  it('turns into a signed overtime counter past the benchmark', () => {
    const state = computePacingGaugeState({ roundSplitsSec: [45], elapsedSec: 95 });
    expect(formatPacingReadout(state)).toBe('+0:05');
    expect(pacingReadoutLabel(state)).toBe('past round 1');
  });

  it('pads seconds and carries minutes', () => {
    const state = computePacingGaugeState({ roundSplitsSec: [45], elapsedSec: 176 });
    expect(formatPacingReadout(state)).toBe('+1:26');
  });

  it('says what is missing before round one is logged', () => {
    const state = computePacingGaugeState({ roundSplitsSec: [], elapsedSec: 10 });
    expect(formatPacingReadout(state)).toBe('—');
    expect(pacingReadoutLabel(state)).toMatch(/Round 1 sets the benchmark/);
  });

  it('reads 0:00 exactly on the benchmark, not +0:00', () => {
    const state = computePacingGaugeState({ roundSplitsSec: [45], elapsedSec: 90 });
    expect(formatPacingReadout(state)).toBe('0:00');
  });
});
