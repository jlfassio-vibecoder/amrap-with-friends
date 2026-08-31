import { describe, expect, it } from 'vitest';
import { computeMissedRoundElapsedSec } from './computeMissedRoundElapsedSec';
import { computePvi } from '@/lib/scoring/computePvi';

describe('computeMissedRoundElapsedSec', () => {
  it('splits the window in proportion to reps', () => {
    // 20 reps a round, noticed 10 reps in: the window holds 1.5 rounds, so the
    // boundary sits two thirds of the way through it.
    const result = computeMissedRoundElapsedSec({
      previousElapsedSec: 120,
      nowElapsedSec: 300,
      repsPerRound: 20,
      repsIntoNextRound: 10,
    });

    expect(result.elapsedSecAtRound).toBe(240);
    expect(result.missedRoundSplitSec).toBe(120);
    expect(result.carriedSplitSec).toBe(60);
    expect(result.correctionSec).toBe(60);
    expect(result.isUncorrected).toBe(false);
  });

  it('leaves the log where it is when no reps of the next round were done', () => {
    const result = computeMissedRoundElapsedSec({
      previousElapsedSec: 120,
      nowElapsedSec: 240,
      repsPerRound: 20,
      repsIntoNextRound: 0,
    });

    expect(result.elapsedSecAtRound).toBe(240);
    expect(result.isUncorrected).toBe(true);
  });

  it('treats a full round of overshoot as the halfway point', () => {
    const result = computeMissedRoundElapsedSec({
      previousElapsedSec: 0,
      nowElapsedSec: 240,
      repsPerRound: 20,
      repsIntoNextRound: 20,
    });

    expect(result.elapsedSecAtRound).toBe(120);
  });

  it('clamps more than a full round of overshoot to a full round', () => {
    const full = computeMissedRoundElapsedSec({
      previousElapsedSec: 0,
      nowElapsedSec: 240,
      repsPerRound: 20,
      repsIntoNextRound: 20,
    });
    const over = computeMissedRoundElapsedSec({
      previousElapsedSec: 0,
      nowElapsedSec: 240,
      repsPerRound: 20,
      repsIntoNextRound: 99,
    });

    expect(over.elapsedSecAtRound).toBe(full.elapsedSecAtRound);
  });

  it('cannot place the boundary without a rep count', () => {
    const result = computeMissedRoundElapsedSec({
      previousElapsedSec: 60,
      nowElapsedSec: 180,
      repsPerRound: 0,
      repsIntoNextRound: 8,
    });

    expect(result.elapsedSecAtRound).toBe(180);
    expect(result.isUncorrected).toBe(true);
  });

  it('never places the round before the one that came first', () => {
    const result = computeMissedRoundElapsedSec({
      previousElapsedSec: 100,
      nowElapsedSec: 101,
      repsPerRound: 20,
      repsIntoNextRound: 19,
    });

    expect(result.elapsedSecAtRound).toBeGreaterThan(100);
    expect(result.elapsedSecAtRound).toBeLessThanOrEqual(101);
  });

  it('is a no-op when no time has passed since the last round', () => {
    const result = computeMissedRoundElapsedSec({
      previousElapsedSec: 240,
      nowElapsedSec: 240,
      repsPerRound: 20,
      repsIntoNextRound: 6,
    });

    expect(result.elapsedSecAtRound).toBe(240);
    expect(result.isUncorrected).toBe(true);
  });

  it('tolerates fractional input from the live clock', () => {
    const result = computeMissedRoundElapsedSec({
      previousElapsedSec: 119.6,
      nowElapsedSec: 300.4,
      repsPerRound: 20,
      repsIntoNextRound: 10,
    });

    expect(Number.isInteger(result.elapsedSecAtRound)).toBe(true);
  });

  it('rescues the pacing score a late log would have destroyed', () => {
    // The reported case: 10-minute mission, 20 reps a round, even ~120s pace,
    // round 3's log missed and noticed 6 reps into round 4.
    const trueSplits = [120, 118, 122, 119, 121];
    const repsPerRound = 20;

    // Logging late folds round 4's first 6 reps into round 3.
    const lateBySec = Math.round((122 * 6) / repsPerRound);
    const lateSplits = [...trueSplits];
    lateSplits[2] += lateBySec;
    lateSplits[3] -= lateBySec;

    const previousElapsedSec = trueSplits[0] + trueSplits[1];
    const nowElapsedSec = previousElapsedSec + lateSplits[2];

    const corrected = computeMissedRoundElapsedSec({
      previousElapsedSec,
      nowElapsedSec,
      repsPerRound,
      repsIntoNextRound: 6,
    });

    const correctedSplit = corrected.missedRoundSplitSec;
    expect(Math.abs(correctedSplit - trueSplits[2])).toBeLessThanOrEqual(2);

    // And the score consequence, which is the whole point of the feature.
    const options = { excludeFirstRound: true };
    const truePvi = computePvi(trueSplits, options)!;
    const latePvi = computePvi(lateSplits, options)!;
    const fixedSplits = [...lateSplits];
    fixedSplits[2] = correctedSplit;
    fixedSplits[3] = lateSplits[2] + lateSplits[3] - correctedSplit;
    const fixedPvi = computePvi(fixedSplits, options)!;

    expect(latePvi).toBeGreaterThan(30); // System Failure, x0.85
    expect(truePvi).toBeLessThan(10); // Elite Pacing, x1.15
    expect(fixedPvi).toBeLessThan(10); // back to Elite
  });
});
