import { describe, expect, it } from 'vitest';
import { findAmqapFlow } from '@/data/amqapFlows';
import { MAX_RATIO } from '@/lib/pacing/pacingGauge';
import { expandAmqapSets } from './expandAmqapSets';
import {
  amqapReadoutLabel,
  elapsedInRoundSec,
  formatAmqapActiveExerciseDetail,
  formatAmqapReadout,
  formatAmqapSetCaption,
  setProgressFromRoundElapsed,
} from './amqapSetGauge';

const foundational = expandAmqapSets(findAmqapFlow('amqap-foundational-10')!);

describe('elapsedInRoundSec', () => {
  it('is mission elapsed before the first log', () => {
    expect(elapsedInRoundSec(40, [])).toBe(40);
  });

  it('restarts from the last logged split', () => {
    expect(elapsedInRoundSec(200, [140])).toBe(60);
    expect(elapsedInRoundSec(140, [140])).toBe(0);
  });

  it('never reads a pass as starting in the future', () => {
    expect(elapsedInRoundSec(139, [140])).toBe(0);
  });

  it('tolerates a missing feed', () => {
    expect(elapsedInRoundSec(Number.NaN, undefined)).toBe(0);
  });
});

describe('setProgressFromRoundElapsed', () => {
  it('starts on the first set at zero', () => {
    const progress = setProgressFromRoundElapsed(0, foundational)!;
    expect(progress.setIndex).toBe(0);
    expect(progress.set.side).toBe('left');
    expect(progress.set.movementName).toBe('90/90 Hip Transitions');
    expect(progress.ratio).toBe(0);
    expect(progress.zone).toBe('optimal');
    expect(progress.isLastSet).toBe(false);
    expect(progress.isActive).toBe(true);
  });

  it('advances at exactly the programmed duration, never into overtime', () => {
    // 25s left 90/90 → at 25 the needle is on right 90/90 at 0.
    const atBoundary = setProgressFromRoundElapsed(25, foundational)!;
    expect(atBoundary.setIndex).toBe(1);
    expect(atBoundary.set.side).toBe('right');
    expect(atBoundary.setElapsedSec).toBe(0);
    expect(atBoundary.zone).toBe('optimal');
    expect(atBoundary.overtimeSec).toBe(0);

    const lastTick = setProgressFromRoundElapsed(24, foundational)!;
    expect(lastTick.setIndex).toBe(0);
    expect(lastTick.zone).not.toBe('overtime');
    expect(lastTick.overtimeSec).toBe(0);
  });

  it('walks through mid-round sides and lands on the last exercise', () => {
    // 25+25+30+30 = 110s programmed before Dog-to-Cobra.
    const onLast = setProgressFromRoundElapsed(110, foundational)!;
    expect(onLast.isLastSet).toBe(true);
    expect(onLast.set.movementName).toBe('Downward-Facing Dog to Cobra');
    expect(onLast.setElapsedSec).toBe(0);
    expect(onLast.overtimeSec).toBe(0);
    expect(onLast.zone).toBe('optimal');
  });

  it('continues through the red only on the last set of the last exercise', () => {
    const overtime = setProgressFromRoundElapsed(145, foundational)!;
    expect(overtime.isLastSet).toBe(true);
    expect(overtime.setElapsedSec).toBe(35);
    expect(overtime.overtimeSec).toBe(5);
    expect(overtime.zone).toBe('overtime');
    expect(overtime.ratio).toBeCloseTo(35 / 30);
  });

  it('warns near the end of the last set without going red early', () => {
    const warning = setProgressFromRoundElapsed(137, foundational)!;
    expect(warning.isLastSet).toBe(true);
    expect(warning.zone).toBe('warning');
    expect(warning.overtimeSec).toBe(0);
  });

  it('resets to the first set when a round is logged', () => {
    const elapsedInRound = elapsedInRoundSec(200, [200]);
    const progress = setProgressFromRoundElapsed(elapsedInRound, foundational)!;
    expect(progress.setIndex).toBe(0);
    expect(progress.setElapsedSec).toBe(0);
    expect(progress.zone).toBe('optimal');
  });

  it('caps the needle but not the overtime counter', () => {
    const stall = setProgressFromRoundElapsed(110 + 30 * 3, foundational)!;
    expect(stall.ratio).toBe(MAX_RATIO);
    expect(stall.overtimeSec).toBe(60);
  });

  it('returns null for an empty program', () => {
    expect(setProgressFromRoundElapsed(10, [])).toBeNull();
  });
});

describe('captions and readout', () => {
  it('names the side in plain English', () => {
    expect(formatAmqapSetCaption(foundational[0])).toBe('90/90 Hip Transitions · Left side');
    expect(formatAmqapSetCaption(foundational[1])).toBe('90/90 Hip Transitions · Right side');
    expect(formatAmqapSetCaption(foundational[4])).toBe('Downward-Facing Dog to Cobra');
  });

  it('puts side, duration, and ~reps next to a current exercise', () => {
    expect(formatAmqapActiveExerciseDetail(foundational[0])).toBe('Left side · 25 sec · ~5 reps');
    expect(formatAmqapActiveExerciseDetail(foundational[4])).toBe('30 sec · ~5 reps');
    const halfMoonRight = expandAmqapSets(findAmqapFlow('amqap-hip-control-10')!).at(-1)!;
    expect(formatAmqapActiveExerciseDetail(halfMoonRight)).toBe('Right side · 15 sec');
  });

  it('counts down, then signs overtime on the last set', () => {
    const left = setProgressFromRoundElapsed(10, foundational)!;
    expect(formatAmqapReadout(left)).toBe('0:15');
    expect(amqapReadoutLabel(left)).toBe('left of this set');

    const overtime = setProgressFromRoundElapsed(145, foundational)!;
    expect(formatAmqapReadout(overtime)).toBe('+0:05');
    expect(amqapReadoutLabel(overtime)).toBe('past this set');
  });
});
