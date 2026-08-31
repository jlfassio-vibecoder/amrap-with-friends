/**
 * The single source of truth for per-route search metadata.
 *
 * Two consumers, deliberately: the SPA ([`useSeo`](../../hooks/useSeo.ts)) writes
 * these into the document head for renderers, and the edge middleware
 * (`middleware.ts`) reads the same table to send `X-Robots-Tag` and to 404
 * unknown paths — which is what crawlers that never run JavaScript actually see.
 * Keep it free of React and of `@/` imports: the middleware bundles it directly.
 */

export const SITE_HOST = 'amrapwithfriends.com';
export const SITE_ORIGIN = `https://${SITE_HOST}`;
export const SITE_NAME = 'AMRAP With Friends';

export const DEFAULT_TITLE = 'AMRAP With Friends — Live Group AMRAP Workout Timer';
export const DEFAULT_DESCRIPTION =
  'AMRAP With Friends is a live group workout timer for As Many Rounds As Possible sessions. Host or join a session, stay on a synced countdown, and race the leaderboard together.';

export interface RouteSeo {
  /** Path pattern. `:name` matches exactly one segment. */
  path: string;
  title: string;
  description: string;
  /**
   * Whether search engines may index this URL.
   *
   * False for every signed-in, private or ephemeral surface. Rally points and
   * missions are an unbounded, short-lived URL space — indexing them would fill
   * the index with dead pages — but they stay `follow` and keep their OG tags so
   * a shared rally link still unfurls in a group chat.
   */
  index: boolean;
}

export const ROUTE_SEO: RouteSeo[] = [
  {
    path: '/',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    index: true,
  },
  {
    path: '/create',
    title: 'Create an AMRAP mission — AMRAP With Friends',
    description:
      'Build an AMRAP workout, pick the time domain, and get a rally link to share. Everyone runs the same synced countdown, wherever they are training.',
    index: true,
  },
  {
    path: '/join',
    title: 'Join an AMRAP mission — AMRAP With Friends',
    description:
      'Open a rally link to join a live AMRAP with friends. No app install — one synced clock, one shared leaderboard.',
    index: true,
  },
  { path: '/rally-point/:rallyPointId', title: 'Rally point', description: '', index: false },
  { path: '/mission/:missionId', title: 'Mission', description: '', index: false },
  { path: '/campaign/join', title: "You've been invited", description: '', index: false },
  { path: '/campaign/new', title: 'New campaign', description: '', index: false },
  { path: '/campaign/:campaignId', title: 'Campaign', description: '', index: false },
  { path: '/squad/join', title: "You've been invited", description: '', index: false },
  { path: '/squad', title: 'Your squad', description: '', index: false },
  { path: '/my-missions', title: 'My missions', description: '', index: false },
  { path: '/intake', title: 'Your profile', description: '', index: false },
  { path: '/hud', title: 'HUD', description: '', index: false },
  { path: '/coach', title: 'Coach', description: '', index: false },
  { path: '/coach/wods', title: 'WOD Builder', description: '', index: false },
];

/** Trailing slashes and repeated slashes are the same URL to us; the canonical never carries them. */
export function normalizePathname(pathname: string): string {
  const withoutQuery = pathname.split(/[?#]/)[0];
  const collapsed = withoutQuery.replace(/\/{2,}/g, '/');
  const trimmed = collapsed.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/** `:param` matches exactly one non-empty segment. No wildcards — every app route is fixed depth. */
export function matchRoutePath(pattern: string, pathname: string): boolean {
  const patternSegments = pattern.split('/');
  const pathSegments = normalizePathname(pathname).split('/');
  if (patternSegments.length !== pathSegments.length) {
    return false;
  }
  return patternSegments.every((segment, i) =>
    segment.startsWith(':') ? pathSegments[i].length > 0 : segment === pathSegments[i]
  );
}

export function findRouteSeo(pathname: string): RouteSeo | undefined {
  return ROUTE_SEO.find((route) => matchRoutePath(route.path, pathname));
}

/** A path the app actually serves. Anything else is a 404, not an empty shell. */
export function isKnownRoute(pathname: string): boolean {
  return findRouteSeo(pathname) !== undefined;
}

export interface ResolvedSeo {
  title: string;
  description: string;
  /** Absolute self-referencing canonical, or null when the page must not be indexed. */
  canonical: string | null;
  /** Value for both the robots meta tag and the `X-Robots-Tag` header. */
  robots: string;
  /** False when the path matches no route — the caller should render a 404. */
  known: boolean;
}

export function resolveSeo(pathname: string): ResolvedSeo {
  const route = findRouteSeo(pathname);
  if (!route) {
    return {
      title: `Page not found — ${SITE_NAME}`,
      description: '',
      canonical: null,
      robots: 'noindex, follow',
      known: false,
    };
  }
  const normalized = normalizePathname(pathname);
  return {
    title: route.title,
    description: route.description || DEFAULT_DESCRIPTION,
    canonical: route.index ? `${SITE_ORIGIN}${normalized}` : null,
    robots: route.index ? 'index, follow' : 'noindex, follow',
    known: true,
  };
}
