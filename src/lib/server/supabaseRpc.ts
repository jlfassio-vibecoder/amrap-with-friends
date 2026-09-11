/**
 * Calling a SECURITY DEFINER RPC with the service-role key.
 *
 * Server-only, and in `src/lib` rather than under `api/` on purpose: every file
 * in `api/` is a route, so a shared helper living there would be deployed as an
 * endpoint of its own.
 */
export async function callServiceRpc(
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

/** Resend's send endpoint. Returns null on success, a reason on failure. */
export async function sendEmail(
  resendKey: string,
  payload: Record<string, unknown>
): Promise<string | null> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return response.ok ? null : `resend_${response.status}`;
  } catch {
    return 'resend_unreachable';
  }
}
