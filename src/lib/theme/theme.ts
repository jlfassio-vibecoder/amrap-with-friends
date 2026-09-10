export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';

/** UA color-scheme for the active theme. `only light` opts out of Chrome Auto Dark. */
export function colorSchemeForTheme(theme: Theme): 'only light' | 'dark' {
  return theme === 'dark' ? 'dark' : 'only light';
}

export function syncColorScheme(theme: Theme): void {
  const scheme = colorSchemeForTheme(theme);
  document.documentElement.style.colorScheme = scheme;
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) {
    meta.setAttribute('content', scheme);
  }
}

export function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function getAppliedTheme(): Theme {
  const applied = document.documentElement.getAttribute('data-theme');
  return applied === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  syncColorScheme(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage failures (private browsing, quota, etc.)
  }
}

export function toggleTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark';
}
