/**
 * The room welcome sender.
 *
 * A sweep on the same per-minute cron as the reminders, claiming rooms that
 * have never been welcomed. `create_room` cannot send this itself -- it is a
 * Postgres function and this database has no pg_net -- and firing it from the
 * client after create_room returns would lose the welcome every time a tab
 * closed, silently, which is the failure this exists to fix.
 *
 * Separate route from the reminder sender so one can fail without taking the
 * other down, and so their logs are separable.
 */
import { callServiceRpc, sendEmail } from '../../src/lib/server/supabaseRpc.ts';
import { buildWelcomeEmail } from '../../src/lib/rooms/welcomeEmail.ts';

interface ClaimedWelcome {
  room_id: string;
  handle: string;
  display_name: string;
  is_active: boolean;
  email: string;
}

export default async function handler(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ ok: false, reason: 'unauthorized' }), { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.REMINDER_FROM_ADDRESS;
  const origin = process.env.PUBLIC_SITE_ORIGIN ?? 'https://www.amrapwithfriends.com';

  if (!supabaseUrl || !serviceKey || !resendKey || !fromAddress) {
    return new Response(JSON.stringify({ ok: false, reason: 'server_misconfigured' }), {
      status: 500,
    });
  }

  const claim = (await callServiceRpc(supabaseUrl, serviceKey, 'claim_room_welcomes', {
    p_limit: 50,
  })) as { ok: boolean; welcomes: ClaimedWelcome[] };

  const welcomes = claim?.welcomes ?? [];
  if (welcomes.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
  }

  const settled: { room_id: string; failed_reason: string | null }[] = [];

  for (const welcome of welcomes) {
    const email = buildWelcomeEmail({
      roomHandle: welcome.handle,
      roomDisplayName: welcome.display_name,
      isActive: welcome.is_active,
      origin,
    });

    const failedReason = await sendEmail(resendKey, {
      from: fromAddress,
      to: welcome.email,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });

    settled.push({ room_id: welcome.room_id, failed_reason: failedReason });
  }

  await callServiceRpc(supabaseUrl, serviceKey, 'settle_room_welcomes', { p_results: settled });

  const failures = settled.filter((entry) => entry.failed_reason !== null).length;
  return new Response(
    JSON.stringify({ ok: true, sent: settled.length - failures, failed: failures }),
    { status: 200 }
  );
}
