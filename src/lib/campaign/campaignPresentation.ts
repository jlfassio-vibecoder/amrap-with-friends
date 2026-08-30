import { addCalendarDays, weekdayOf } from './calendarDate';
import type { CampaignSlot } from './types';

export const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Formats a 'YYYY-MM-DD' from its parts in UTC.
 *
 * `new Date('2026-10-05')` is midnight UTC, so formatting it in a negative
 * offset renders the day before. These are calendar dates with no timezone of
 * their own, so they are read and rendered as UTC throughout.
 */
function toUtcDate(ymd: string): Date {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatCampaignDate(ymd: string): string {
  return toUtcDate(ymd).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  });
}

/** "Mon 5 Oct" — the calendar row label. */
export function formatOccurrenceDate(ymd: string): string {
  return `${WEEKDAY_SHORT[weekdayOf(ymd)]} ${formatCampaignDate(ymd)}`;
}

/** "5 Oct – 28 Nov 2026" for the campaign header. */
export function formatCampaignSpan(startDate: string, endDate: string): string {
  const year = toUtcDate(endDate).getUTCFullYear();
  return `${formatCampaignDate(startDate)} – ${formatCampaignDate(endDate)} ${year}`;
}

/** "Mondays at 06:30" — describes a repeating slot, so the day is plural. */
export function formatSlotLabel(slot: CampaignSlot): string {
  return `${WEEKDAY_LABELS[slot.weekday]}s at ${slot.timeLocal}`;
}

/**
 * Only the two fields the grouping actually reads. Both the planner's
 * occurrences and the API's rows satisfy this, and neither has to grow a field
 * it does not otherwise need.
 */
export interface WeekGroupable {
  weekNumber: number;
  sequence: number;
}

export interface CampaignWeekGroup<T extends WeekGroupable = WeekGroupable> {
  weekNumber: number;
  occurrences: T[];
}

export function groupOccurrencesByWeek<T extends WeekGroupable>(
  occurrences: T[]
): Array<CampaignWeekGroup<T>> {
  const byWeek = new Map<number, T[]>();
  for (const occurrence of occurrences) {
    const bucket = byWeek.get(occurrence.weekNumber);
    if (bucket) {
      bucket.push(occurrence);
    } else {
      byWeek.set(occurrence.weekNumber, [occurrence]);
    }
  }
  return [...byWeek.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekNumber, entries]) => ({
      weekNumber,
      occurrences: [...entries].sort((a, b) => a.sequence - b.sequence),
    }));
}

/**
 * Which weeks to show in the create-campaign schedule preview.
 *
 * Always keeps the opening stretch, the finale, and every week that holds a
 * retest — otherwise a mid-campaign checkpoint vanishes into "N more weeks".
 */
export function selectCampaignPreviewWeekNumbers(input: {
  weekNumbers: number[];
  retestWeekNumbers: Iterable<number>;
  openingWeeks: number;
}): number[] {
  const { weekNumbers, openingWeeks } = input;
  if (weekNumbers.length === 0) {
    return [];
  }

  const selected = new Set<number>();
  for (const weekNumber of weekNumbers.slice(0, Math.max(0, openingWeeks))) {
    selected.add(weekNumber);
  }
  selected.add(weekNumbers[weekNumbers.length - 1]);
  for (const weekNumber of input.retestWeekNumbers) {
    selected.add(weekNumber);
  }

  return weekNumbers.filter((weekNumber) => selected.has(weekNumber));
}

export interface CampaignProgress {
  done: number;
  total: number;
  /** 0-100, rounded. 0 when the campaign has no sessions rather than NaN. */
  percent: number;
}

export function campaignProgress(done: number, total: number): CampaignProgress {
  if (total <= 0) {
    return { done: 0, total: 0, percent: 0 };
  }
  const clamped = Math.max(0, Math.min(done, total));
  return { done: clamped, total, percent: Math.round((clamped / total) * 100) };
}

/**
 * Campaigns start tomorrow by default: today's slot may already have passed,
 * and a plan you cannot act on until next week reads as broken.
 */
export function defaultCampaignStartDate(today: string): string {
  return addCalendarDays(today, 1);
}

/**
 * Sensible weekday defaults, spread across the week rather than bunched, so a
 * host who never touches the day picker still gets a trainable pattern.
 */
const SUGGESTED_WEEKDAYS: Record<number, number[]> = {
  1: [1],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
};

export function suggestedSlots(sessionsPerWeek: number, timeLocal = '18:00'): CampaignSlot[] {
  const weekdays = SUGGESTED_WEEKDAYS[sessionsPerWeek] ?? SUGGESTED_WEEKDAYS[3];
  return weekdays.map((weekday) => ({ weekday, timeLocal }));
}

/** "24 sessions · 3 a week · 8 weeks" */
export function formatCampaignShape(weekCount: number, sessionsPerWeek: number): string {
  const total = weekCount * sessionsPerWeek;
  const perWeek = sessionsPerWeek === 1 ? '1 a week' : `${sessionsPerWeek} a week`;
  return `${total} sessions · ${perWeek} · ${weekCount} weeks`;
}
