const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Within this fraction of expected minutes, the week still reads as on pace. */
export const BASELINE_PACE_BAND = 0.1;

export type BaselinePaceStatus = 'ahead' | 'on_pace' | 'behind' | 'met';

export type BaselinePace = {
  status: BaselinePaceStatus;
  /** Short label for the footer headline. */
  label: string;
  /** One-line coaching detail under the label. */
  detail: string;
  /** Minutes the baseline would expect by `now` if volume were spread evenly. */
  expectedMinutes: number;
  /** Minutes still needed to hit the baseline this week. */
  remainingMinutesToBaseline: number;
  /** Whole days left before the week resets (ceil of remaining time). */
  remainingDays: number;
};

function endMs(weekEndsAt: string | Date): number | null {
  const value =
    typeof weekEndsAt === 'string' ? new Date(weekEndsAt).getTime() : weekEndsAt.getTime();
  return Number.isFinite(value) ? value : null;
}

/**
 * Whether this week's locked minutes are ahead of, on, or behind an even pace
 * toward a weekly volume target, given how much of the local week remains.
 *
 * `targetNoun` only changes the met / short copy ("baseline" vs "target").
 */
export function evaluateBaselinePace(
  weekMinutes: number,
  baselineMinutes: number,
  weekEndsAt: string | Date,
  nowMs: number = Date.now(),
  targetNoun: 'baseline' | 'target' = 'baseline'
): BaselinePace | null {
  if (baselineMinutes <= 0) {
    return null;
  }

  const endsAt = endMs(weekEndsAt);
  if (endsAt === null) {
    return null;
  }

  const remainingMs = Math.max(0, endsAt - nowMs);
  const elapsedMs = Math.min(WEEK_MS, Math.max(0, WEEK_MS - remainingMs));
  const fractionElapsed = elapsedMs / WEEK_MS;
  const expectedMinutes = Math.round(baselineMinutes * fractionElapsed);
  const remainingMinutesToBaseline = Math.max(0, baselineMinutes - weekMinutes);
  const remainingDays = Math.max(0, Math.ceil(remainingMs / DAY_MS));
  const metLabel = targetNoun === 'target' ? 'Target met' : 'Baseline met';
  const shortOfLabel = targetNoun === 'target' ? 'target' : 'baseline';

  if (weekMinutes >= baselineMinutes) {
    return {
      status: 'met',
      label: metLabel,
      detail: 'Quota cleared for this week',
      expectedMinutes,
      remainingMinutesToBaseline: 0,
      remainingDays,
    };
  }

  const needDetail =
    remainingDays <= 0
      ? `${remainingMinutesToBaseline} min short of ${shortOfLabel}`
      : `Need ${remainingMinutesToBaseline} min over ${remainingDays} day${
          remainingDays === 1 ? '' : 's'
        }`;

  // Monday at the open: nothing is expected yet.
  if (expectedMinutes <= 0) {
    return {
      status: weekMinutes > 0 ? 'ahead' : 'on_pace',
      label: weekMinutes > 0 ? 'Ahead of pace' : 'On pace',
      detail: needDetail,
      expectedMinutes: 0,
      remainingMinutesToBaseline,
      remainingDays,
    };
  }

  const ratio = weekMinutes / expectedMinutes;
  if (ratio > 1 + BASELINE_PACE_BAND) {
    const projected = fractionElapsed > 0 ? Math.round(weekMinutes / fractionElapsed) : weekMinutes;
    return {
      status: 'ahead',
      label: 'Ahead of pace',
      detail: `On track for ~${projected} min`,
      expectedMinutes,
      remainingMinutesToBaseline,
      remainingDays,
    };
  }

  if (ratio < 1 - BASELINE_PACE_BAND) {
    return {
      status: 'behind',
      label: 'Behind pace',
      detail: needDetail,
      expectedMinutes,
      remainingMinutesToBaseline,
      remainingDays,
    };
  }

  return {
    status: 'on_pace',
    label: 'On pace',
    detail: needDetail,
    expectedMinutes,
    remainingMinutesToBaseline,
    remainingDays,
  };
}
