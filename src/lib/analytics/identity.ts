const ANON_ID_KEY = 'amrap_anon_id';

/** Long-lived per-browser id (localStorage, survives across sessions/tabs) — distinct from the per-session tokens in sessionIdentity.ts. */
export function getOrCreateAnonId(): string {
  try {
    const existing = localStorage.getItem(ANON_ID_KEY);
    if (existing) {
      return existing;
    }
    const created = crypto.randomUUID();
    localStorage.setItem(ANON_ID_KEY, created);
    return created;
  } catch {
    return 'unknown';
  }
}
