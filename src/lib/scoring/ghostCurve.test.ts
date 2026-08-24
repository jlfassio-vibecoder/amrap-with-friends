import { describe, expect, it } from 'vitest';
import { buildGhostRepCurve, ghostRepsAtElapsed } from './ghostCurve';

const REPS_PER_ROUND = 40;

describe('buildGhostRepCurve', () => {
  it('starts at origin and ends at terminal reps', () => {
    const curve = buildGhostRepCurve(
      [
        { roundIndex: 0, elapsedSecAtRound: 60 },
        { roundIndex: 1, elapsedSecAtRound: 120 },
      ],
      REPS_PER_ROUND,
      0,
      300
    );

    expect(curve[0]).toEqual({ elapsedSec: 0, reps: 0 });
    expect(curve[curve.length - 1]).toEqual({ elapsedSec: 300, reps: 80 });
  });

  it('includes round boundary nodes', () => {
    const curve = buildGhostRepCurve(
      [
        { roundIndex: 0, elapsedSecAtRound: 60 },
        { roundIndex: 1, elapsedSecAtRound: 120 },
      ],
      REPS_PER_ROUND,
      0,
      300
    );

    expect(curve).toContainEqual({ elapsedSec: 60, reps: 40 });
    expect(curve).toContainEqual({ elapsedSec: 120, reps: 80 });
  });

  it('interpolates linearly with no rounds to partial reps at duration', () => {
    const curve = buildGhostRepCurve([], REPS_PER_ROUND, 15, 300);

    expect(curve).toEqual([
      { elapsedSec: 0, reps: 0 },
      { elapsedSec: 300, reps: 15 },
    ]);
    expect(ghostRepsAtElapsed(curve, 150)).toBe(7);
  });
});

describe('ghostRepsAtElapsed', () => {
  const curve = buildGhostRepCurve(
    [
      { roundIndex: 0, elapsedSecAtRound: 60 },
      { roundIndex: 1, elapsedSecAtRound: 120 },
    ],
    REPS_PER_ROUND,
    0,
    300
  );

  it('returns 0 at origin', () => {
    expect(ghostRepsAtElapsed(curve, 0)).toBe(0);
  });

  it('interpolates between round boundaries', () => {
    expect(ghostRepsAtElapsed(curve, 90)).toBe(60);
  });

  it('returns terminal reps past duration', () => {
    expect(ghostRepsAtElapsed(curve, 400)).toBe(80);
    expect(ghostRepsAtElapsed(curve, 300)).toBe(80);
  });

  it('floors interpolated values', () => {
    expect(ghostRepsAtElapsed(curve, 89)).toBe(59);
  });

  it('returns 0 for negative elapsed seconds', () => {
    expect(ghostRepsAtElapsed(curve, -5)).toBe(0);
  });
});
