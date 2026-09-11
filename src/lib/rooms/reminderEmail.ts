import { roomInviteUrl } from '@/lib/rooms/roomInvite';

export type ReminderKind = '24h' | '1h';

export interface ReminderEmailInput {
  kind: ReminderKind;
  roomHandle: string;
  roomDisplayName: string;
  /** The mission's absolute start. Rendered in the *room's* zone, not the server's. */
  scheduledAt: Date;
  roomTimezone: string;
  durationMinutes: number;
  /** The workout's own name, when the room ran one from the library. */
  workoutName?: string;
  /** Where the links point, e.g. `https://www.amrapwithfriends.com`. */
  origin: string;
  /** Opaque, unguessable, and the only thing an unsubscribe link needs. */
  unsubscribeToken: string;
}

export interface ReminderEmail {
  subject: string;
  text: string;
  html: string;
  /** RFC 8058. Gmail and Outlook render their own unsubscribe control from these. */
  headers: Record<string, string>;
}

/**
 * When the mission starts, written in the room's timezone with the zone named.
 *
 * The zone abbreviation is not decoration. A reminder is read on a phone that
 * may be in a different zone from the room, and "6:00 PM" with no qualifier is
 * the single most likely way for an athlete to miss the mission they opted in
 * to be reminded about.
 */
export function formatReminderTime(at: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  return formatter.format(at);
}

/**
 * Deliberately the raw function path rather than a prettier `/room-reminders/off`
 * rewrite. Every entry in vercel.json's rewrites maps an SPA route onto the app
 * shell, and `appRewrites.test.ts` enforces exactly that; adding an API
 * destination would make the rewrite list mean two things. Nobody reads an
 * unsubscribe URL, and the invariant is worth more than the tidier path.
 */
export function unsubscribeUrl(origin: string, token: string): string {
  return `${origin}/api/room-reminders/unsubscribe?t=${encodeURIComponent(token)}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * The reminder itself.
 *
 * Two kinds, and the difference is not the wording but the job. The 24h mail
 * exists so the athlete can *plan* -- it names the day and carries the room
 * link. The 1h mail exists so they *show up*, so it leads with the time and
 * the join link and says almost nothing else. Treating them as one template
 * with a swapped adverb would make the second one worse at the only thing it
 * has to do.
 */
export function buildReminderEmail(input: ReminderEmailInput): ReminderEmail {
  const {
    kind,
    roomHandle,
    roomDisplayName,
    scheduledAt,
    roomTimezone,
    durationMinutes,
    workoutName,
    origin,
    unsubscribeToken,
  } = input;

  const when = formatReminderTime(scheduledAt, roomTimezone);
  const roomUrl = roomInviteUrl(origin, roomHandle);
  const optOut = unsubscribeUrl(origin, unsubscribeToken);
  const workout = workoutName
    ? `${workoutName} · ${durationMinutes} min`
    : `${durationMinutes} min`;

  const subject =
    kind === '1h'
      ? `Starting in an hour: ${roomDisplayName}`
      : `Tomorrow with ${roomDisplayName}: ${when}`;

  const lead =
    kind === '1h'
      ? `${roomDisplayName} starts in about an hour — ${when}.`
      : `${roomDisplayName} has a mission coming up: ${when}.`;

  const text = [
    lead,
    '',
    workout,
    '',
    `Join: ${roomUrl}`,
    '',
    `Stop these reminders: ${optOut}`,
  ].join('\n');

  const html = [
    `<p>${escapeHtml(lead)}</p>`,
    `<p><strong>${escapeHtml(workout)}</strong></p>`,
    `<p><a href="${escapeHtml(roomUrl)}">Join the mission</a></p>`,
    `<p style="font-size:12px;color:#666">`,
    `<a href="${escapeHtml(optOut)}">Stop reminders from ${escapeHtml(roomDisplayName)}</a>`,
    `</p>`,
  ].join('');

  return {
    subject,
    text,
    html,
    headers: {
      'List-Unsubscribe': `<${optOut}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}
