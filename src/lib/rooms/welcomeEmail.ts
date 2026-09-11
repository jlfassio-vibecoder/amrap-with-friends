import { roomInviteUrl } from '@/lib/rooms/roomInvite';

export interface WelcomeEmailInput {
  roomHandle: string;
  roomDisplayName: string;
  /**
   * Whether the room can already run missions. A room with no entitlement is
   * read-only, and a host told to "schedule your first mission" would hit
   * `room_inactive` with no idea why.
   */
  isActive: boolean;
  /** Where the links point, e.g. `https://www.amrapwithfriends.com`. */
  origin: string;
}

export interface WelcomeEmail {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * The steps a host should actually take next, which are not the same steps for
 * every host.
 *
 * An active room's first job is to get a mission on the clock and a link into
 * the hands of the people who might come. An inactive one cannot do either, so
 * telling it to "schedule your first mission" sends the host at a button that
 * returns `room_inactive` and teaches them the product is broken. The honest
 * version names the blocker and says who clears it.
 */
export function welcomeSteps(isActive: boolean, roomUrl: string): string[] {
  if (!isActive) {
    return [
      'Your room is set up, but it is not running missions yet — that needs to be switched on at our end.',
      'Reply to this email and we will activate it, usually the same day.',
      `In the meantime your room page is live at ${roomUrl} — add a short intro so it is ready when the first athlete lands.`,
    ];
  }

  return [
    'Schedule your first mission — pick a workout and a start time from your room dashboard.',
    `Share your rally link: ${roomUrl}`,
    'Anyone can train with you without an account. They can save their result and join the room afterwards.',
  ];
}

/**
 * The welcome itself.
 *
 * Short on purpose. A coach who has just created a room wants to know what to
 * do in the next five minutes, not to read the product's philosophy, and a
 * long first email from a new sending domain is also the one most likely to be
 * filed as marketing.
 */
export function buildWelcomeEmail(input: WelcomeEmailInput): WelcomeEmail {
  const { roomHandle, roomDisplayName, isActive, origin } = input;
  const roomUrl = roomInviteUrl(origin, roomHandle);
  const steps = welcomeSteps(isActive, roomUrl);

  const subject = `${roomDisplayName} is ready — here's what's next`;
  const opening = `Your room is live at ${roomUrl}.`;

  const text = [
    opening,
    '',
    ...steps.map((step) => `• ${step}`),
    '',
    'See you at the rally point.',
  ].join('\n');

  const html = [
    `<p>${escapeHtml(opening)}</p>`,
    '<ul>',
    ...steps.map((step) => `<li>${escapeHtml(step)}</li>`),
    '</ul>',
    `<p><a href="${escapeHtml(`${origin}/host`)}">Open your dashboard</a></p>`,
  ].join('');

  return { subject, text, html };
}
