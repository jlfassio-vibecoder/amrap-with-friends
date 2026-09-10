import { isGuestOpenPath } from '@/lib/auth/guestOpenPaths';

export const POST_AUTH_PATH_KEY = 'amrap:postAuthPath';

/** Same-origin relative paths only — mirrors IntakePage safeNext, without a /hud default. */
export function safePostAuthPath(raw: string | null | undefined): string | null {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) {
    return raw;
  }
  return null;
}

/**
 * Where to send the athlete after Create account / homepage signup.
 * Returns null to stay on the current route (guest-open / join).
 * Never returns /intake.
 */
export function resolvePostAuthDestination(input: {
  pathname: string;
  next?: string | null;
}): string | null {
  if (isGuestOpenPath(input.pathname)) {
    return null;
  }

  const next = safePostAuthPath(input.next ?? null);
  if (next && next !== '/intake' && !next.startsWith('/intake?')) {
    return next;
  }

  return '/create';
}

export function setPostAuthPathIntent(path: string): void {
  const safe = safePostAuthPath(path);
  if (!safe || typeof sessionStorage === 'undefined') {
    return;
  }
  sessionStorage.setItem(POST_AUTH_PATH_KEY, safe);
}

export function clearPostAuthPathIntent(): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }
  sessionStorage.removeItem(POST_AUTH_PATH_KEY);
}

export function peekPostAuthPathIntent(): string | null {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }
  return safePostAuthPath(sessionStorage.getItem(POST_AUTH_PATH_KEY));
}

/** Read and clear a one-shot post-auth path (e.g. after Google returns). */
export function consumePostAuthPathIntent(): string | null {
  const path = peekPostAuthPathIntent();
  clearPostAuthPathIntent();
  return path;
}
