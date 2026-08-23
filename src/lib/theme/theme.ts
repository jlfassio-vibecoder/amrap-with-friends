export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';

// Copilot suggestion ignored: theme helpers are thin DOM/localStorage wrappers; behavior is covered by App.test ThemeProvider integration.
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
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage failures (private browsing, quota, etc.)
  }
}

export function toggleTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark';
}
