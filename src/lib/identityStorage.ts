/**
 * Durable browser identity for missions and rally points.
 *
 * These values used to live in `sessionStorage`, which is scoped to a single
 * tab. A second tab therefore read no participant id, so the athlete either
 * joined again — a duplicate row on the roster and the leaderboard — or, once
 * the mission was live and `join_mission` refused with "Mission locked", sat
 * there with an empty participant id and a Log round button that silently did
 * nothing. Guests have no `auth.uid()`, so the server cannot dedupe them; the
 * browser has to remember who it already is.
 *
 * `localStorage` is shared by every tab on the origin, which is exactly the
 * scope an athlete identity needs. Reads fall back to the old `sessionStorage`
 * key and migrate it, so a mission already in flight when this shipped keeps
 * working. Entries are pruned after `RETENTION_MS` so a browser that runs many
 * missions does not accumulate identity keys forever.
 */

const SEEN_INDEX_KEY = 'amrap_identity_seen';
const IDENTITY_KEY_PREFIX = 'amrap_';
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_TRACKED_IDS = 50;

function durableStore(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function legacyStore(): Storage | null {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}

function readRaw(store: Storage | null, key: string): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Returns whether the value actually landed — callers must not assume it did. */
function writeRaw(store: Storage | null, key: string, value: string): boolean {
  if (!store) {
    return false;
  }
  try {
    store.setItem(key, value);
    return true;
  } catch {
    /* storage unavailable or full */
    return false;
  }
}

function removeRaw(store: Storage | null, key: string): void {
  try {
    store?.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

export function identityStorageKey(prefix: string, id: string): string {
  return `${prefix}_${id}`;
}

function readSeenIndex(store: Storage | null): Record<string, number> {
  const raw = readRaw(store, SEEN_INDEX_KEY);
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      (entry): entry is [string, number] => typeof entry[1] === 'number'
    );
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

/** Drop every `amrap_*_<id>` key for an id we are done tracking. */
function forgetId(store: Storage | null, id: string): void {
  if (!store) {
    return;
  }
  const suffix = `_${id}`;
  const doomed: string[] = [];
  try {
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (
        key &&
        key !== SEEN_INDEX_KEY &&
        key.startsWith(IDENTITY_KEY_PREFIX) &&
        key.endsWith(suffix)
      ) {
        doomed.push(key);
      }
    }
  } catch {
    return;
  }
  for (const key of doomed) {
    removeRaw(store, key);
  }
}

/** Record this id as active and evict identities older than the retention window. */
function touchAndPrune(store: Storage | null, id: string, now: number): void {
  if (!store) {
    return;
  }

  const seen = readSeenIndex(store);
  seen[id] = now;

  const ordered = Object.entries(seen).sort((a, b) => b[1] - a[1]);
  const kept: Record<string, number> = {};

  ordered.forEach(([seenId, lastTouchedMs], rank) => {
    const expired = now - lastTouchedMs > RETENTION_MS;
    if (seenId !== id && (expired || rank >= MAX_TRACKED_IDS)) {
      forgetId(store, seenId);
      return;
    }
    kept[seenId] = lastTouchedMs;
  });

  writeRaw(store, SEEN_INDEX_KEY, JSON.stringify(kept));
}

/**
 * Read a per-id identity value, migrating a legacy per-tab value on first read
 * so an athlete mid-mission does not lose their seat when this ships.
 */
export function readIdentityItem(prefix: string, id: string): string | null {
  const key = identityStorageKey(prefix, id);
  const durable = durableStore();
  const stored = readRaw(durable, key);
  if (stored !== null) {
    return stored;
  }

  const legacy = readRaw(legacyStore(), key);
  if (legacy === null) {
    return null;
  }

  writeIdentityItem(prefix, id, legacy);
  return legacy;
}

export function writeIdentityItem(prefix: string, id: string, value: string): void {
  const key = identityStorageKey(prefix, id);
  const durable = durableStore();

  if (writeRaw(durable, key, value)) {
    touchAndPrune(durable, id, Date.now());
    // Keep one source of truth so a later clear cannot resurrect a stale value.
    // Only once the durable copy is safely written — dropping the per-tab copy
    // after a failed write would leave the athlete with no identity at all.
    // Copilot suggestion ignored: failed durable writes already keep sessionStorage (fixed in a18c1a2).
    removeRaw(legacyStore(), key);
    return;
  }

  // localStorage is full, blocked, or unavailable. Fall back to the per-tab
  // store: an identity that dies with the tab still beats no identity, and it
  // is what this storage did before it was made durable.
  writeRaw(legacyStore(), key, value);
}

export function removeIdentityItem(prefix: string, id: string): void {
  const key = identityStorageKey(prefix, id);
  removeRaw(durableStore(), key);
  removeRaw(legacyStore(), key);
}
