/**
 * Calendar-date arithmetic on 'YYYY-MM-DD' strings.
 *
 * Everything here works in UTC on purpose. These are wall-clock calendar
 * dates, not instants: adding 7 days to a date must always land on the same
 * weekday, which arithmetic on a local `Date` (or on epoch milliseconds) does
 * not guarantee across a daylight-saving boundary. `rallySchedule`'s
 * `addOneCalendarDay` uses the same technique for the same reason.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** True for a well-formed 'YYYY-MM-DD' that names a real calendar day. */
export function isCalendarDate(value: string): boolean {
  if (!ISO_DATE.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rejects rollovers like 2026-02-30, which Date.UTC silently normalises.
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** True for a 24-hour wall-clock time, 'HH:MM'. */
export function isLocalTime(value: string): boolean {
  return LOCAL_TIME.test(value);
}

export function addCalendarDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
}

/** Day of week for a calendar date: 0 (Sunday) to 6 (Saturday). */
export function weekdayOf(ymd: string): number {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}
