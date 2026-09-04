import { getOrCreateAnonId } from '@/lib/analytics/identity';
import { callRpc } from '@/lib/api/callRpc';

/** Matches crypto.randomUUID() and the SQL guard in link_anon_identity. */
const LINKABLE_ANON_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isLinkableAnonId(value: string | null | undefined): boolean {
  if (value == null) return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'unknown') return false;
  return LINKABLE_ANON_ID_RE.test(trimmed);
}

/** Fire-and-forget stitch of this browser's anon_id to the signed-in user. Never throws. */
export async function linkCurrentAnonIdentity(): Promise<void> {
  try {
    const anonId = getOrCreateAnonId();
    if (!isLinkableAnonId(anonId)) return;
    await callRpc('link_anon_identity', { p_anon_id: anonId });
  } catch {
    // Swallow — sign-in must not fail because of analytics stitch.
  }
}
