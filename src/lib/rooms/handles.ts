import { ROUTE_SEO } from '@/lib/seo/routes';

/**
 * A room's address is `/@handle`, so a handle is a URL segment before it is a
 * name. Two things follow, and both are decided here rather than at each call
 * site: what shape a handle may take, and which words a host may never take.
 *
 * The reserved list is not hand-maintained. Every first segment the router
 * already answers is reserved automatically -- `handles.test.ts` fails if a new
 * route appears that a host could have claimed first -- because the failure
 * mode is silent and permanent: a host who takes `blog` on Tuesday breaks
 * `/blog` for everyone, and taking it back means breaking their links instead.
 */

/** Words reserved regardless of routing: support surfaces, and roles a handle must not imply. */
export const RESERVED_WORDS: readonly string[] = [
  'admin',
  'administrator',
  'api',
  'billing',
  'coach',
  'help',
  'host',
  'legal',
  'login',
  'logout',
  'me',
  'moderator',
  'official',
  'owner',
  'root',
  'security',
  'settings',
  'signin',
  'signout',
  'signup',
  'staff',
  'status',
  'support',
  'system',
  'team',
] as const;

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 24;

/** Lower-case letters, digits, underscore; must start with a letter or digit. */
const HANDLE_SHAPE = /^[a-z0-9][a-z0-9_]{2,23}$/;

/** The first path segment of every route the app or the site already answers. */
export function routeFirstSegments(): string[] {
  const segments = new Set<string>();
  for (const route of ROUTE_SEO) {
    const first = route.path.split('/').filter(Boolean)[0];
    // `/` has no segment, and a route that is itself a parameter reserves nothing.
    if (first && !first.startsWith(':')) {
      segments.add(first.toLowerCase());
    }
  }
  return [...segments].sort();
}

export function reservedHandles(): Set<string> {
  return new Set([...RESERVED_WORDS, ...routeFirstSegments()]);
}

export type HandleRejection = 'too_short' | 'too_long' | 'bad_shape' | 'reserved';

export type HandleCheck = { ok: true; handle: string } | { ok: false; reason: HandleRejection };

/**
 * Validate a requested handle, returning the normalized form on success.
 *
 * Normalizing before checking is the point: `@Coach` and `@coach` are the same
 * URL, so an uppercase spelling must not be a way past the reserved list.
 */
export function checkHandle(requested: string): HandleCheck {
  const handle = requested.trim().toLowerCase();

  if (handle.length < HANDLE_MIN) {
    return { ok: false, reason: 'too_short' };
  }
  if (handle.length > HANDLE_MAX) {
    return { ok: false, reason: 'too_long' };
  }
  if (!HANDLE_SHAPE.test(handle)) {
    return { ok: false, reason: 'bad_shape' };
  }
  if (reservedHandles().has(handle)) {
    return { ok: false, reason: 'reserved' };
  }

  return { ok: true, handle };
}

/** What to tell the host. Says what is wrong and what to do, never just "invalid". */
export function handleRejectionMessage(reason: HandleRejection): string {
  switch (reason) {
    case 'too_short':
      return `Handles are at least ${HANDLE_MIN} characters.`;
    case 'too_long':
      return `Handles are at most ${HANDLE_MAX} characters.`;
    case 'bad_shape':
      return 'Use lowercase letters, numbers and underscores, starting with a letter or number.';
    case 'reserved':
      return 'That one is reserved. Try adding your sport, city, or gym name.';
  }
}
