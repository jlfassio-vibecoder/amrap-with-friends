import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getOrCreateAnonId } from '@/lib/analytics/identity';

const ANON_ID_KEY = 'amrap_anon_id';
const UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function installMemoryLocalStorage(): Storage {
  const map = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key) {
      return map.has(key) ? (map.get(key) ?? null) : null;
    },
    key(index) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key) {
      map.delete(key);
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
  return storage;
}

beforeEach(() => {
  installMemoryLocalStorage();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getOrCreateAnonId', () => {
  it('mints a UUID, persists it, and returns the same id on the next call', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(UUID);

    const first = getOrCreateAnonId();
    expect(first).toBe(UUID);
    expect(localStorage.getItem(ANON_ID_KEY)).toBe(UUID);
    expect(getOrCreateAnonId()).toBe(UUID);
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
  });

  it('returns null (never unknown) when getItem throws', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(getOrCreateAnonId()).toBeNull();
    expect(getOrCreateAnonId()).not.toBe('unknown');
  });

  it('returns null (never unknown) when setItem throws', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(UUID);
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });

    expect(getOrCreateAnonId()).toBeNull();
    expect(getOrCreateAnonId()).not.toBe('unknown');
  });

  it('replaces a stored unknown with a new UUID', () => {
    localStorage.setItem(ANON_ID_KEY, 'unknown');
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(UUID);

    expect(getOrCreateAnonId()).toBe(UUID);
    expect(localStorage.getItem(ANON_ID_KEY)).toBe(UUID);
  });

  it('returns null when replacing stored unknown fails to persist', () => {
    localStorage.setItem(ANON_ID_KEY, 'unknown');
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(UUID);
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });

    expect(getOrCreateAnonId()).toBeNull();
  });
});
