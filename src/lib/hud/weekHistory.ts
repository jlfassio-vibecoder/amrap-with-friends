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
