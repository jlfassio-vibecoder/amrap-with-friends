import { computeBaseScore } from '@/lib/scoring/computeBaseScore';

export interface GhostRepCurvePoint {
  elapsedSec: number;
  reps: number;
}

export interface GhostRoundInput {
  roundIndex: number;
  elapsedSecAtRound: number;
}

export function buildGhostRepCurve(
  rounds: GhostRoundInput[],
  repsPerRound: number,
  partialReps: number,
  durationSec: number
): GhostRepCurvePoint[] {
  const sortedRounds = [...rounds].sort((a, b) => a.roundIndex - b.roundIndex);
  const roundCount = sortedRounds.length;
  const terminalReps = computeBaseScore(roundCount, partialReps, repsPerRound);

  const points: GhostRepCurvePoint[] = [{ elapsedSec: 0, reps: 0 }];

  for (const round of sortedRounds) {
    const reps = (round.roundIndex + 1) * repsPerRound;
    const lastPoint = points[points.length - 1];

    if (round.elapsedSecAtRound <= lastPoint.elapsedSec) {
      continue;
    }

    points.push({
      elapsedSec: round.elapsedSecAtRound,
      reps,
    });
  }

  const lastPoint = points[points.length - 1];
  if (durationSec > lastPoint.elapsedSec) {
    points.push({
      elapsedSec: durationSec,
      reps: terminalReps,
    });
  } else if (durationSec === lastPoint.elapsedSec && lastPoint.reps !== terminalReps) {
    points[points.length - 1] = {
      elapsedSec: durationSec,
      reps: terminalReps,
    };
  }

  return points;
}

function resolveCurvePoints(
  curve: GhostRepCurvePoint[] | { points: GhostRepCurvePoint[] }
): GhostRepCurvePoint[] {
  return Array.isArray(curve) ? curve : curve.points;
}

export function ghostRepsAtElapsed(
  curve: GhostRepCurvePoint[] | { points: GhostRepCurvePoint[] },
  currentElapsedSec: number
): number {
  const points = resolveCurvePoints(curve);

  if (points.length === 0 || currentElapsedSec <= 0) {
    return 0;
  }

  const terminal = points[points.length - 1];
  if (currentElapsedSec >= terminal.elapsedSec) {
    return terminal.reps;
  }

  for (let index = 1; index < points.length; index += 1) {
    const next = points[index];
    const prev = points[index - 1];

    if (currentElapsedSec > next.elapsedSec) {
      continue;
    }

    if (currentElapsedSec === prev.elapsedSec) {
      return prev.reps;
    }

    const timeDelta = next.elapsedSec - prev.elapsedSec;
    if (timeDelta <= 0) {
      return prev.reps;
    }

    const repDelta = next.reps - prev.reps;
    const interpolated =
      prev.reps +
      ((currentElapsedSec - prev.elapsedSec) / timeDelta) * repDelta;

    return Math.floor(interpolated);
  }

  return 0;
}
