/**
 * The unsubscribe token.
 *
 * An unsubscribe link has to work for someone who is not signed in, may be
 * reading on a device that never had an account, and who is by definition
 * annoyed. Asking them to log in to stop email is how a sender gets marked as
 * spam, so the link itself has to carry the authority.
 *
 * It carries it as an HMAC over (user_id, room_id) rather than as a stored
 * secret, which means nothing new in the schema and no lookup table to keep.
 * The signature is the whole security property: the payload is public and
 * guessable -- both ids appear elsewhere -- so an attacker who could forge the
 * tag could unsubscribe anyone. They cannot without the server secret.
 *
 * Deliberately no expiry. A reminder someone kept for a year should still have
 * a working unsubscribe; an expired one is a dead link on a mail we sent, and
 * the failure mode of "the stop button did not work" is the one that costs the
 * sending domain its reputation.
 */

export interface ReminderTokenPayload {
  userId: string;
  roomId: string;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return base64UrlEncode(new Uint8Array(signature));
}

/** Constant-time compare, so a wrong tag cannot be narrowed down by timing it. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function createReminderToken(
  payload: ReminderTokenPayload,
  secret: string
): Promise<string> {
  const body = base64UrlEncode(new TextEncoder().encode(`${payload.userId}:${payload.roomId}`));
  const tag = await sign(body, secret);
  return `${body}.${tag}`;
}

/**
 * Null for anything that does not verify, with no distinction between
 * "malformed" and "bad signature" -- the caller has nothing useful to do with
 * the difference and an attacker would.
 */
export async function verifyReminderToken(
  token: string,
  secret: string
): Promise<ReminderTokenPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [body, tag] = parts;
  let expected: string;
  try {
    expected = await sign(body, secret);
  } catch {
    return null;
  }

  if (!timingSafeEqual(tag, expected)) {
    return null;
  }

  let decoded: string;
  try {
    decoded = new TextDecoder().decode(base64UrlDecode(body));
  } catch {
    return null;
  }

  const [userId, roomId] = decoded.split(':');
  if (!userId || !roomId) {
    return null;
  }

  return { userId, roomId };
}
