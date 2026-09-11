/**
 * The room-reminder sender.
 *
 * Woken every minute by Vercel Cron. All the deciding happens in
 * `claim_due_room_reminders`, which hands back rows it has already claimed, so
 * this route's only jobs are to call Resend and report what happened.
 *
 * It lives here rather than in a Supabase edge function because the database
 * has no `pg_net` and no Vault: getting cron to make an HTTPS call from
 * Postgres would mean a new extension and a service-role key stored inside the
 * database it unlocks. Vercel already holds these secrets.
 */
import { createReminderToken } from '../../src/lib/rooms/reminderToken.ts';
import { buildReminderEmail, type ReminderKind } from '../../src/lib/rooms/reminderEmail.ts';

interface ClaimedReminder {
  mission_id: string;
  user_id: string;
  kind: ReminderKind;
  email: string;
  scheduled_at: string;
  duration_minutes: number;
  workout: { name?: string } | null;
  room_handle: string;
  room_name: string;
  room_timezone: string;
  room_id: string;
}

interface SettleResult {
  mission_id: string;
  user_id: string;
  kind: ReminderKind;
  failed_reason: string | null;
}

async function callRpc(
  supabaseUrl: string,
  serviceKey: string,
  fn: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });

  if (!response.ok) {
    throw new Error(`${fn} failed: ${response.status}`);
  }

  return response.json();
}

export default async function handler(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('Authorization');

  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Without this the
  // route is an open trigger for mail, which is the one thing it must not be.
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ ok: false, reason: 'unauthorized' }), { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.REMINDER_FROM_ADDRESS;
  const tokenSecret = process.env.REMINDER_TOKEN_SECRET;
  const origin = process.env.PUBLIC_SITE_ORIGIN ?? 'https://www.amrapwithfriends.com';

  if (!supabaseUrl || !serviceKey || !resendKey || !fromAddress || !tokenSecret) {
    return new Response(JSON.stringify({ ok: false, reason: 'server_misconfigured' }), {
      status: 500,
    });
  }

  const claim = (await callRpc(supabaseUrl, serviceKey, 'claim_due_room_reminders', {
    p_limit: 100,
  })) as { ok: boolean; reminders: ClaimedReminder[] };

  const reminders = claim?.reminders ?? [];
  if (reminders.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
  }

  const settled: SettleResult[] = [];

  // Sequential, not Promise.all. A burst of parallel sends is how a sending
  // domain trips a provider rate limit, and the batch is already bounded at
  // 100 by the claim.
  for (const reminder of reminders) {
    const token = await createReminderToken(
      { userId: reminder.user_id, roomId: reminder.room_id },
      tokenSecret
    );

    const email = buildReminderEmail({
      kind: reminder.kind,
      roomHandle: reminder.room_handle,
      roomDisplayName: reminder.room_name,
      scheduledAt: new Date(reminder.scheduled_at),
      roomTimezone: reminder.room_timezone,
      durationMinutes: reminder.duration_minutes,
      workoutName: reminder.workout?.name,
      origin,
      unsubscribeToken: token,
    });

    let failedReason: string | null = null;
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: reminder.email,
          subject: email.subject,
          text: email.text,
          html: email.html,
          headers: email.headers,
        }),
      });

      if (!response.ok) {
        failedReason = `resend_${response.status}`;
      }
    } catch {
      failedReason = 'resend_unreachable';
    }

    settled.push({
      mission_id: reminder.mission_id,
      user_id: reminder.user_id,
      kind: reminder.kind,
      failed_reason: failedReason,
    });
  }

  await callRpc(supabaseUrl, serviceKey, 'settle_room_reminders', { p_results: settled });

  const failures = settled.filter((entry) => entry.failed_reason !== null).length;
  return new Response(
    JSON.stringify({ ok: true, sent: settled.length - failures, failed: failures }),
    { status: 200 }
  );
}
