// Client-side preview of a Featured WOD recurring rule's next occurrences,
// so a coach can sanity-check days/times/timezone (catching a DST edge or
// an off-by-one day) before ever saving the schedule. Mirrors the same
// scan-forward technique run_featured_wod_scheduler() and
// featured_wod_next_occurrence() use server-side in Postgres, just done in
// JS against the browser's Intl data instead of pg_timezone_names.

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function zonedParts(
  date: Date,
  timeZone: string
): { year: number; month: number; day: number; hour: number; minute: number; second: number } | null {
  try {
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
  } catch {
    // Unknown/invalid IANA zone name — let the caller's timezoneRecognized
    // check catch this; the preview just comes back empty.
    return null;
  }
}

function calendarDateInTimeZone(date: Date, timeZone: string): string | null {
  const parts = zonedParts(date, timeZone);
  if (!parts) {
    return null;
  }
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function addCalendarDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
}

function dayOfWeek(ymd: string): number {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function zonedWallClockToUtc(ymd: string, hhmm: string, timeZone: string): Date | null {
  const [year, month, day] = ymd.split('-').map(Number);
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);

  // A single guess-and-correct step (sample the zone's offset once, apply
  // it once) is wrong on the exact calendar day a zone's UTC offset itself
  // changes (a DST transition): the offset sampled at the initial guess
  // can differ from the offset that actually applies at the corrected
  // instant. Iterating a few times converges on the correct instant either
  // way — it's a no-op extra pass on an ordinary day, since diff is 0 after
  // the first correction.
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const tz = zonedParts(new Date(guess), timeZone);
    if (!tz) {
      return null;
    }
    const asUtc = Date.UTC(tz.year, tz.month - 1, tz.day, tz.hour, tz.minute, tz.second);
    const diff = asUtc - target;
    if (diff === 0) {
      break;
    }
    guess -= diff;
  }
  return new Date(guess);
}

/** Returns the next `count` occurrences (as ISO instants) of a recurring
 * days-of-week + local-times-of-day rule in the given timezone, strictly
 * after `now`. Scans an 8-day window (today + 0..7), which always finds a
 * match since `daysOfWeek` has at least one entry. Returns [] for an
 * unrecognized timezone or malformed times rather than throwing — this is
 * a best-effort preview, not the source of truth (the server validates for
 * real on save). */
export function computeNextFeaturedOccurrences(
  daysOfWeek: number[],
  timesLocal: string[],
  timezone: string,
  now: Date,
  count: number
): Date[] {
  if (daysOfWeek.length === 0 || timesLocal.length === 0) {
    return [];
  }

  const today = calendarDateInTimeZone(now, timezone);
  if (today === null) {
    return [];
  }

  const candidates: Date[] = [];
  for (let i = 0; i <= 7; i++) {
    const ymd = addCalendarDays(today, i);
    if (!daysOfWeek.includes(dayOfWeek(ymd))) {
      continue;
    }
    for (const time of timesLocal) {
      const candidate = zonedWallClockToUtc(ymd, time, timezone);
      if (candidate && candidate.getTime() > now.getTime()) {
        candidates.push(candidate);
      }
    }
  }

  candidates.sort((a, b) => a.getTime() - b.getTime());
  return candidates.slice(0, count);
}
