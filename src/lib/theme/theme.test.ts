import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  THEME_STORAGE_KEY,
  applyTheme,
  colorSchemeForTheme,
  getAppliedTheme,
  toggleTheme,
} from './theme';

function installMemoryLocalStorage(): void {
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
}

describe('theme color-scheme sync', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
    localStorage.removeItem(THEME_STORAGE_KEY);

    let meta = document.querySelector('meta[name="color-scheme"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'color-scheme');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'only light');
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
    localStorage.removeItem(THEME_STORAGE_KEY);
  });

  it('maps light to only light and dark to dark', () => {
    expect(colorSchemeForTheme('light')).toBe('only light');
    expect(colorSchemeForTheme('dark')).toBe('dark');
  });

  it('applyTheme light sets data-theme and only light scheme', () => {
    applyTheme('light');

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('only light');
    expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe(
      'only light'
    );
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(getAppliedTheme()).toBe('light');
  });

  it('applyTheme dark sets data-theme and dark scheme', () => {
    applyTheme('dark');

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe(
      'dark'
    );
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(getAppliedTheme()).toBe('dark');
  });

  it('toggle round-trip restores light scheme', () => {
    applyTheme('dark');
    const next = toggleTheme(getAppliedTheme());
    applyTheme(next);

    expect(next).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('only light');
    expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe(
      'only light'
    );
  });
});
