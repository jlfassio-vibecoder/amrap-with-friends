import { mapAuthError } from '@/lib/auth/mapAuthError';

const OAUTH_ERROR_KEYS = ['error', 'error_code', 'error_description'] as const;

/**
 * Reads OAuth failure query params from a Google/GoTrue return URL.
 * Prefers error_description, then error_code, then error.
 */
export function readOAuthReturnError(
  searchParams: URLSearchParams,
  options?: Parameters<typeof mapAuthError>[1]
): string | null {
  const description = searchParams.get('error_description')?.trim();
  const code = searchParams.get('error_code')?.trim();
  const error = searchParams.get('error')?.trim();
  const raw = description || code || error;
  if (!raw) {
    return null;
  }
  return mapAuthError(raw, options);
}

/** True when the search string carries any OAuth error param. */
export function hasOAuthReturnErrorParams(searchParams: URLSearchParams): boolean {
  return OAUTH_ERROR_KEYS.some((key) => {
    const value = searchParams.get(key);
    return value !== null && value.trim() !== '';
  });
}

/**
 * Drops OAuth error params from a search string. Returns '' or `?…` without a leading `?` empty.
 * Caller should use the returned search (with or without `?`) for replaceState.
 */
export function stripOAuthReturnErrorParams(searchParams: URLSearchParams): string {
  const next = new URLSearchParams(searchParams);
  for (const key of OAUTH_ERROR_KEYS) {
    next.delete(key);
  }
  const serialized = next.toString();
  return serialized.length > 0 ? `?${serialized}` : '';
}
