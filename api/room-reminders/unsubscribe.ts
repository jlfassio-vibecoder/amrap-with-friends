/**
 * Stop reminders, with no account and no session.
 *
 * Two verbs, and only one of them writes.
 *
 * GET never changes anything: it verifies the token and renders a button. That
 * is not politeness, it is the difference between working and not. Corporate
 * mail scanners and link prefetchers fetch every URL in a message with nobody
 * clicking, so a GET that unsubscribed would switch reminders off for people
 * who never touched the link -- and the symptom is indistinguishable from the
 * feature working correctly.
 *
 * POST does the write, covering both the button on that page and RFC 8058
 * one-click (Gmail and Outlook POST with no body, advertised by the
 * List-Unsubscribe-Post header the email carries). Scanners do not POST.
 *
 * Authority is the HMAC in the token, verified before anything is written.
 * There is no session to check and deliberately no login wall: making someone
 * sign in to stop email is how a sending domain earns spam complaints.
 */
import { verifyReminderToken } from '../../src/lib/rooms/reminderToken.ts';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * A mail client's one-click POST, as opposed to the confirmation form's. The
 * form posts a normal form content type; RFC 8058 clients send none.
 */
function isOneClick(request: Request): boolean {
  return !(request.headers.get('Content-Type') ?? '').includes('application/x-www-form-urlencoded');
}

function page(title: string, body: string, status: number): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>${title}</title>` +
      `<style>body{font:16px/1.5 system-ui,sans-serif;margin:0;min-height:100vh;` +
      `display:grid;place-items:center;padding:24px;background:#faf8f5;color:#1a1a1a}` +
      `main{max-width:32rem;text-align:center}a{color:#b4441f}</style>` +
      `<main>${body}</main>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

export default async function handler(request: Request): Promise<Response> {
  const tokenSecret = process.env.REMINDER_TOKEN_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!tokenSecret || !supabaseUrl || !serviceKey) {
    return page('Something went wrong', '<h1>Something went wrong</h1>', 500);
  }

  const token = new URL(request.url).searchParams.get('t') ?? '';
  const payload = await verifyReminderToken(token, tokenSecret);

  if (!payload) {
    return request.method === 'POST'
      ? new Response(null, { status: 400 })
      : page(
          'Link not valid',
          '<h1>That link is not valid</h1>' +
            '<p>You can turn reminders off from the room page at any time.</p>',
          400
        );
  }

  // A verified token on a GET buys a confirmation page, never a write.
  if (request.method !== 'POST') {
    return page(
      'Stop reminders',
      '<h1>Stop reminders from this room?</h1>' +
        '<p>You will stay a member, and you can turn reminders back on from the ' +
        'room page.</p>' +
        `<form method="post" action="${escapeHtml(request.url)}">` +
        '<button type="submit" style="font:inherit;padding:10px 20px;border-radius:8px;' +
        'border:0;background:#b4441f;color:#fff;cursor:pointer">Stop reminders</button>' +
        '</form>',
      200
    );
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/admin_set_room_reminders`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_user_id: payload.userId,
      p_room_id: payload.roomId,
      p_enabled: false,
    }),
  });

  if (!response.ok) {
    return isOneClick(request)
      ? new Response(null, { status: 500 })
      : page('Something went wrong', '<h1>Something went wrong</h1>', 500);
  }

  // Both paths have already written; the distinction is only what gets drawn.
  return isOneClick(request)
    ? new Response(null, { status: 200 })
    : page(
        'Reminders off',
        '<h1>Reminders off</h1>' +
          '<p>You will not get mission reminders from this room any more. ' +
          'You are still a member, and you can turn them back on from the room page.</p>',
        200
      );
}
