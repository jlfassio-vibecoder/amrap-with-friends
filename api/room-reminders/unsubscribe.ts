/**
 * Stop reminders, with no account and no session.
 *
 * Two verbs, because two different things click this link. A person clicking
 * in their mail reader sends GET and should see a page confirming it worked.
 * Gmail and Outlook send POST with no body (RFC 8058 one-click, advertised by
 * the List-Unsubscribe-Post header the email carries) and want a bare 200.
 *
 * Authority is the HMAC in the token, verified here before anything is written.
 * There is no session to check and deliberately no login wall: making someone
 * sign in to stop email is how a sending domain earns spam complaints.
 */
import { verifyReminderToken } from '../../src/lib/rooms/reminderToken.ts';

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
    return request.method === 'POST'
      ? new Response(null, { status: 500 })
      : page('Something went wrong', '<h1>Something went wrong</h1>', 500);
  }

  if (request.method === 'POST') {
    return new Response(null, { status: 200 });
  }

  return page(
    'Reminders off',
    '<h1>Reminders off</h1>' +
      '<p>You will not get mission reminders from this room any more. ' +
      'You are still a member, and you can turn them back on from the room page.</p>',
    200
  );
}
