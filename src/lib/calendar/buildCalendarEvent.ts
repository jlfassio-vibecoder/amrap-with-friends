// "Save to Calendar" for a single scheduled mission (e.g. the Featured
// WOD's next occurrence). Two independent outputs from the same input:
// a downloadable .ics file (RFC 5545 — works with Apple/Outlook/Google via
// import) and a direct "Add to Google Calendar" URL (no auth, no API key —
// just Google's pre-filled event page).

export interface CalendarEventInput {
  /** Stable identifier for the UID, so re-saving the same occurrence
   * doesn't create a duplicate in calendars that dedupe by UID. Typically
   * the mission id once generated, or the workout id + ISO time when it
   * isn't yet. */
  uid: string;
  title: string;
  /** Free-text detail, e.g. workout focus plus a join link. */
  description: string;
  startsAt: Date;
  durationMinutes: number;
  /** Where it happens. Most calendar apps make this tappable. */
  location?: string;
  /** The canonical page for the event, for apps that show a link field. */
  url?: string;
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
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Folds to 75 *octets*, counted in UTF-8 and never inside a code point.
 *
 * The first version counted UTF-16 code units, which is the same number only
 * for ASCII. Two things go wrong once the text is not ASCII, and a room's
 * display name is exactly where that arrives: a line of accented characters
 * silently exceeds the limit, and `slice` can cut an emoji in half, leaving a
 * lone surrogate that is not valid UTF-8 at all. Continuation lines count
 * their own leading space, which the first version also missed.
 */
function foldLine(line: string): string {
  const LIMIT = 75;
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= LIMIT) {
    return line;
  }

  const chunks: string[] = [];
  // Code points, not code units: iterating a string yields whole characters,
  // so a surrogate pair can never be split across the boundary.
  let current = '';
  let currentOctets = 0;
  let limit = LIMIT;

  for (const character of line) {
    const size = encoder.encode(character).length;
    if (currentOctets + size > limit) {
      chunks.push(current);
      current = '';
      currentOctets = 0;
      // Every line after the first spends one octet on its leading space.
      limit = LIMIT - 1;
    }
    current += character;
    currentOctets += size;
  }
  if (current.length > 0) {
    chunks.push(current);
  }

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
    'PRODID:-//AMRAP With Friends//Mission//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${icsEscape(input.uid)}@amrapwithfriends`,
    `DTSTAMP:${toIcsUtc(now)}`,
    `DTSTART:${toIcsUtc(input.startsAt)}`,
    `DTEND:${toIcsUtc(endsAt)}`,
    `SUMMARY:${icsEscape(input.title)}`,
    `DESCRIPTION:${icsEscape(input.description)}`,
    ...(input.location ? [`LOCATION:${icsEscape(input.location)}`] : []),
    // URL takes a URI value, which is not text-escaped -- a comma or semicolon
    // in a URL is part of the URL, and escaping it would break the link.
    ...(input.url ? [`URL:${input.url}`] : []),
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
    ...(input.location ? { location: input.location } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
