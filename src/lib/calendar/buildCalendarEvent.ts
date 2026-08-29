// "Save to Calendar" for a single scheduled session (e.g. the Featured
// WOD's next occurrence). Two independent outputs from the same input:
// a downloadable .ics file (RFC 5545 — works with Apple/Outlook/Google via
// import) and a direct "Add to Google Calendar" URL (no auth, no API key —
// just Google's pre-filled event page).

export interface CalendarEventInput {
  /** Stable identifier for the UID, so re-saving the same occurrence
   * doesn't create a duplicate in calendars that dedupe by UID. Typically
   * the session id once generated, or the workout id + ISO time when it
   * isn't yet. */
  uid: string;
  title: string;
  /** Free-text detail, e.g. workout focus plus a join link. */
  description: string;
  startsAt: Date;
  durationMinutes: number;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** UTC timestamp in RFC 5545's basic format (YYYYMMDDTHHMMSSZ) — using
 * UTC throughout sidesteps VTIMEZONE entirely, which every calendar app
 * correctly converts back to the viewer's local time. */
function toIcsUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}` +
    `T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`
  );
}

/** Escapes text per RFC 5545 §3.3.11 (backslash, semicolon, comma, and
 * embedded newlines), and folds any resulting line over 75 octets into a
 * continuation line (CRLF + single leading space) per §3.1 — long
 * descriptions (a join link plus workout detail) will otherwise corrupt
 * some calendar parsers. */
function icsEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function foldLine(line: string): string {
  const LIMIT = 75;
  if (line.length <= LIMIT) {
    return line;
  }
  const chunks: string[] = [];
  let rest = line;
  while (rest.length > LIMIT) {
    chunks.push(rest.slice(0, LIMIT));
    rest = rest.slice(LIMIT);
  }
  chunks.push(rest);
  return chunks.join('\r\n ');
}

/** Builds a minimal, spec-correct single-VEVENT .ics file (no recurrence —
 * this is one occurrence, matching what the card actually shows; a
 * recurring VEVENT would go stale the moment a coach edits or deletes the
 * schedule with no way for the saved event to know). */
export function buildIcsFileContent(input: CalendarEventInput): string {
  const now = new Date();
  const endsAt = new Date(input.startsAt.getTime() + input.durationMinutes * 60_000);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AMRAP With Friends//Featured WOD//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${icsEscape(input.uid)}@amrapwithfriends`,
    `DTSTAMP:${toIcsUtc(now)}`,
    `DTSTART:${toIcsUtc(input.startsAt)}`,
    `DTEND:${toIcsUtc(endsAt)}`,
    `SUMMARY:${icsEscape(input.title)}`,
    `DESCRIPTION:${icsEscape(input.description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** A one-click "Add to Google Calendar" link — Google's own pre-filled
 * event-creation page, not the Calendar API, so it needs no auth or key
 * and works for a signed-out visitor too. */
export function buildGoogleCalendarUrl(input: CalendarEventInput): string {
  const endsAt = new Date(input.startsAt.getTime() + input.durationMinutes * 60_000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title,
    dates: `${toIcsUtc(input.startsAt)}/${toIcsUtc(endsAt)}`,
    details: input.description,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
