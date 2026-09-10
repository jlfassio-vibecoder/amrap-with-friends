export const HOST_ACTIVE_MISSION_LIMIT = 3;

export type RallyDay = 'today' | 'tomorrow';

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function zonedParts(
  date: Date,
  timeZone: string
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

export function calendarDateInTimeZone(date: Date, timeZone: string): string {
  const parts = zonedParts(date, timeZone);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function addOneCalendarDay(ymd: string): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
}

function zonedWallClockToUtcIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): string {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const tz = zonedParts(new Date(utcGuess), timeZone);
  const asUtc = Date.UTC(tz.year, tz.month - 1, tz.day, tz.hour, tz.minute, tz.second);
  return new Date(utcGuess - (asUtc - utcGuess)).toISOString();
}

export function rallyLocalDateTimeToIso(
  day: RallyDay,
  timeHhMm: string,
  timeZone: string,
  now: Date
): string | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(timeHhMm.trim());
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    return null;
  }

  const today = calendarDateInTimeZone(now, timeZone);
  const ymd = day === 'today' ? today : addOneCalendarDay(today);
  const [year, month, date] = ymd.split('-').map(Number);
  return zonedWallClockToUtcIso(year, month, date, hour, minute, timeZone);
}

export function isRallyTimeAllowed(iso: string, timeZone: string, now: Date): boolean {
  const rally = new Date(iso);
  if (!Number.isFinite(rally.getTime()) || rally.getTime() <= now.getTime()) {
    return false;
  }

  const today = calendarDateInTimeZone(now, timeZone);
  const tomorrow = addOneCalendarDay(today);
  const rallyDay = calendarDateInTimeZone(rally, timeZone);
  return rallyDay === today || rallyDay === tomorrow;
}

export function defaultRallyTime(now: Date, timeZone: string): string {
  const later = new Date(now.getTime() + 60 * 60 * 1000);
  const parts = zonedParts(later, timeZone);
  return `${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

export function rallyIsoToDayAndTime(
  iso: string,
  timeZone: string,
  now: Date
): { day: RallyDay; time: string } | null {
  const rally = new Date(iso);
  if (!Number.isFinite(rally.getTime())) {
    return null;
  }

  const today = calendarDateInTimeZone(now, timeZone);
  const tomorrow = addOneCalendarDay(today);
  const rallyDay = calendarDateInTimeZone(rally, timeZone);

  let day: RallyDay;
  if (rallyDay === today) {
    day = 'today';
  } else if (rallyDay === tomorrow) {
    day = 'tomorrow';
  } else {
    return null;
  }

  const parts = zonedParts(rally, timeZone);
  return {
    day,
    time: `${pad2(parts.hour)}:${pad2(parts.minute)}`,
  };
}
