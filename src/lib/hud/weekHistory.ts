import type { HudHistoryWeek } from '@/lib/hud/types';

/**
 * Week selection for the HUD's history panel.
 *
 * The HUD deliberately has no page-wide "viewing the past" mode: the live
 * cards (time since last mission, overtraining risk, benchmarks due) stay
 * pinned to now, and only this one panel travels. So selection is a plain
 * index into `telemetry.weeks`, and `null` means "nothing inspected" rather
 * than "the current week" — those are different states, and conflating them
 * would make the panel impossible to close.
 */

/** The current week is always the last bucket the RPC returns. */
export function currentWeekIndex(weeks: readonly HudHistoryWeek[]): number | null {
  return weeks.length > 0 ? weeks.length - 1 : null;
}

export function isCurrentWeek(weeks: readonly HudHistoryWeek[], index: number): boolean {
  return index === currentWeekIndex(weeks);
}

/**
 * Move `delta` weeks and clamp at both ends. Clamping rather than wrapping:
 * stepping past the oldest week should stop, not silently jump the athlete to
 * this week and make them think their history is a loop.
 */
export function stepWeekIndex(
  weeks: readonly HudHistoryWeek[],
  index: number,
  delta: number
): number {
  if (weeks.length === 0) {
    return 0;
  }
  return Math.min(weeks.length - 1, Math.max(0, index + delta));
}

export function weekAt(
  weeks: readonly HudHistoryWeek[],
  index: number | null
): HudHistoryWeek | null {
  if (index === null || index < 0 || index >= weeks.length) {
    return null;
  }
  return weeks[index];
}

/** True once any week in the window has a locked mission — otherwise there is nothing to inspect. */
export function hasInspectableHistory(weeks: readonly HudHistoryWeek[]): boolean {
  return weeks.some((week) => week.missionCount > 0);
}

/**
 * "Aug 25 – Aug 31", the Monday-to-Sunday span this week covers.
 *
 * `weekStart` arrives as an instant (Monday 00:00 local, sent as timestamptz),
 * so it can be read straight through `toLocaleDateString` — unlike a bare
 * `YYYY-MM-DD`, which would parse as UTC and can render the wrong local day.
 */
export function formatWeekRangeLabel(weekStartIso: string): string {
  const start = new Date(weekStartIso);
  if (Number.isNaN(start.getTime())) {
    return 'Unknown week';
  }

  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 6);

  const format = (date: Date) =>
    date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return `${format(start)} – ${format(end)}`;
}

/** Percent of the athlete's weekly baseline this week's minutes covered, capped for the bar's width. */
export function baselineFillPercent(minutes: number, baselineMinutes: number): number {
  if (baselineMinutes <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, (minutes / baselineMinutes) * 100));
}

export type WeekMinutesVsPrevious = {
  /** Minutes from the prior local week bucket, or null when history has no prior week. */
  previousMinutes: number | null;
  /**
   * Percent change in minutes vs that prior week. Null with no prior week, or a
   * zero prior total (a ratio against zero is not a percent).
   */
  minutesChangePercent: number | null;
};

/** Current week vs the week before it, from the same `weeks` array `hud_telemetry` returns. */
export function summarizeWeekMinutesVsPrevious(
  weeks: readonly HudHistoryWeek[]
): WeekMinutesVsPrevious {
  if (weeks.length < 2) {
    return { previousMinutes: null, minutesChangePercent: null };
  }

  const current = weeks[weeks.length - 1]!;
  const previous = weeks[weeks.length - 2]!;
  const previousMinutes = previous.minutes;
  const minutesChangePercent =
    previousMinutes > 0
      ? Math.round(((current.minutes - previousMinutes) / previousMinutes) * 1000) / 10
      : null;

  return { previousMinutes, minutesChangePercent };
}

export type WeekToDateVsPrevious = {
  /**
   * Locked minutes from the prior week that had already landed by the same
   * clock time one week ago (`now - 7 days`). Null when there is no prior week,
   * or when that week has missions we cannot inspect lock-by-lock.
   */
  previousWeekToDateMinutes: number | null;
  /**
   * Percent change of this week's minutes so far vs that prior week-to-date
   * total. Null with no prior WTD, or a zero prior WTD (ratio against zero is
   * not a percent).
   */
  weekToDateChangePercent: number | null;
};

/**
 * Locked minutes from `previousWeek` that had already landed by `now - 7 days`.
 *
 * Needs the prior week's mission list (lock timestamps). A week that only
 * reports a minutes total cannot support this cut — return null rather than
 * inventing a same-time figure from the full-week sum.
 */
export function previousWeekToDateMinutes(
  previousWeek: HudHistoryWeek | null | undefined,
  nowMs: number = Date.now()
): number | null {
  if (!previousWeek) {
    return null;
  }

  // missionCount > 0 with no mission rows means payload drift — we cannot cut
  // the prior week at "this time last week" without lock timestamps.
  if (previousWeek.missionCount > 0 && previousWeek.missions.length === 0) {
    return null;
  }

  const cutoffMs = nowMs - 7 * 24 * 60 * 60 * 1000;
  let total = 0;
  for (const mission of previousWeek.missions) {
    const lockedMs = new Date(mission.lockedAt).getTime();
    if (!Number.isFinite(lockedMs)) {
      return null;
    }
    if (lockedMs <= cutoffMs) {
      total += mission.durationMinutes;
    }
  }
  return total;
}

/** Same weekday/time comparison against the prior week bucket in `weeks`. */
export function summarizeWeekToDateVsPrevious(
  weeks: readonly HudHistoryWeek[],
  nowMs: number = Date.now()
): WeekToDateVsPrevious {
  if (weeks.length < 2) {
    return { previousWeekToDateMinutes: null, weekToDateChangePercent: null };
  }

  const current = weeks[weeks.length - 1]!;
  const previousWtd = previousWeekToDateMinutes(weeks[weeks.length - 2], nowMs);
  if (previousWtd === null) {
    return { previousWeekToDateMinutes: null, weekToDateChangePercent: null };
  }

  const weekToDateChangePercent =
    previousWtd > 0
      ? Math.round(((current.minutes - previousWtd) / previousWtd) * 1000) / 10
      : null;

  return { previousWeekToDateMinutes: previousWtd, weekToDateChangePercent };
}
