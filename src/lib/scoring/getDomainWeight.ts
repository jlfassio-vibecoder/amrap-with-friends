import { MAX_TIME_CAP, MIN_TIME_CAP, type MissionTimeCap } from '@/lib/timeDomains';

/**
 * How much a mission's clock is worth, as a multiplier on the base score.
 *
 * This used to be a switch on the four canonical minutes with everything else
 * falling through to 1.0. That was safe only while 5, 10, 15 and 20 were the
 * sole legal clocks. Once the in-between minutes are selectable, a lookup has
 * two failure modes: a 7-minute mission silently scoring at the 5-minute
 * weight, and — if you fix that by bucketing the ranges — a cliff at every
 * range boundary that the athlete can now stand next to. Under bucketing,
 * 10 → 12 minutes buys 20% more reps *and* a 25% multiplier bump, while
 * 7 → 10 minutes buys nothing. That is a farmable seam, not a scoring rule.
 *
 * So the weight is interpolated through the same four anchors instead. It is
 * exactly backwards compatible at 5 / 10 / 15 / 20 — every score already stored
 * in `score_breakdown` keeps its meaning — and it rises smoothly everywhere
 * else, so no minute is worth choosing for the multiplier alone.
 *
 * Outside the legal range the curve stops rather than continuing: a 45-minute
 * coach WOD is a clock this ladder was never designed against, and inventing a
 * weight for it is worse than holding at the top of the range.
 */
const ANCHORS: ReadonlyArray<readonly [minutes: MissionTimeCap, weight: number]> = [
  [5, 1.0],
  [10, 1.2],
  [15, 1.5],
  [20, 1.8],
];

function interpolate(durationMinutes: number): number {
  const [firstMinutes, firstWeight] = ANCHORS[0];
  const [secondMinutes, secondWeight] = ANCHORS[1];
  if (durationMinutes <= firstMinutes) {
    const slope = (secondWeight - firstWeight) / (secondMinutes - firstMinutes);
    return firstWeight + (durationMinutes - firstMinutes) * slope;
  }

  for (let index = 1; index < ANCHORS.length; index += 1) {
    const [lowMinutes, lowWeight] = ANCHORS[index - 1];
    const [highMinutes, highWeight] = ANCHORS[index];
    if (durationMinutes <= highMinutes) {
      const slope = (highWeight - lowWeight) / (highMinutes - lowMinutes);
      return lowWeight + (durationMinutes - lowMinutes) * slope;
    }
  }

  const [lastMinutes, lastWeight] = ANCHORS[ANCHORS.length - 1];
  const [previousMinutes, previousWeight] = ANCHORS[ANCHORS.length - 2];
  const slope = (lastWeight - previousWeight) / (lastMinutes - previousMinutes);
  return lastWeight + (durationMinutes - lastMinutes) * slope;
}

const FLOOR = interpolate(MIN_TIME_CAP);
const CEILING = interpolate(MAX_TIME_CAP);

export function getDomainWeight(durationMinutes: number): number {
  const clamped = Math.min(Math.max(interpolate(durationMinutes), FLOOR), CEILING);
  // Two decimals: the anchors are two-decimal values and float interpolation
  // between them is not, and a score breakdown that reads 1.2000000000000002 is
  // a bug report waiting to happen.
  return Math.round(clamped * 100) / 100;
}
