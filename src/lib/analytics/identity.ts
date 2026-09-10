import { canUseIdentifiedAnalytics } from '@/lib/analytics/consent';

const ANON_ID_KEY = 'amrap_anon_id';

/**
 * Long-lived per-browser id (localStorage, survives across missions/tabs) —
 * distinct from the per-mission tokens in missionIdentity.ts.
 *
 * The consent gate lives here rather than at each call site because this is
 * the only place the id is minted or read: nothing downstream can identify a
 * visitor without going through this function, so one check covers track(),
 * the content beacon, presence and the identity link. The check comes before
 * any storage access, so a gated visitor is not merely unreported — their
 * device is never touched, which is what Article 5(3) actually governs.
 */
export function getOrCreateAnonId(): string | null {
  if (!canUseIdentifiedAnalytics()) {
    return null;
  }
  try {
    const existing = localStorage.getItem(ANON_ID_KEY);
    if (existing && existing !== 'unknown') {
      return existing;
    }
    const created = crypto.randomUUID();
    localStorage.setItem(ANON_ID_KEY, created);
    return created;
  } catch {
    return null;
  }
}
