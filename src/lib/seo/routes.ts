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

/**
 * Static pages built by Astro. Real HTML in the first response, which is the
 * only thing an AI crawler ever reads — none of them execute JavaScript.
 */
export const CONTENT_ROUTES: RouteSeo[] = [
  {
    path: '/',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    index: true,
  },
  {
    path: '/amrap-timer',
    title: 'Free AMRAP Timer — Online, No Signup',
    description:
      'A free online AMRAP timer for 5, 10, 15 and 20 minute workouts. Countdown clock, round counter, audible cues. No signup, no app install, no ads.',
    index: true,
  },
  {
    path: '/amrap-workouts',
    title: 'AMRAP Workouts — 150 Bodyweight Sessions, 5 to 20 Minutes',
    description:
      'A library of AMRAP workouts you can run today. Browse by time domain or by training stimulus, see every movement with coaching cues, and run any of them on a shared timer.',
    index: true,
  },
  {
    path: '/exercises',
    title: 'AMRAP Exercise Library — Form and Coaching Cues',
    description:
      'Every movement in the AMRAP workout library, with setup and execution, the coaching cue that matters under fatigue, and the workouts that programme it.',
    index: true,
  },
  {
    path: '/guides',
    title: 'AMRAP Guides — How the Format Actually Works',
    description:
      'Plain answers to the questions people actually ask about AMRAP training: what it means, how to score it, how to pace it, and how it differs from EMOM and Tabata.',
    index: true,
  },
  {
    path: '/guides/what-is-amrap',
    title: 'What Does AMRAP Mean? — As Many Rounds As Possible',
    description:
      'AMRAP means As Many Rounds (or Reps) As Possible. What the format is, how a round works, how the score is written, and why it scales to any fitness level.',
    index: true,
  },
  {
    path: '/guides/amrap-vs-emom-vs-tabata',
    title: 'AMRAP vs EMOM vs Tabata — What Each Format Trains',
    description:
      'AMRAP, EMOM and Tabata are three different clocks, and they train three different things. How each one works, what it asks of you, and when to pick which.',
    index: true,
  },
  {
    path: '/guides/how-to-score-an-amrap',
    title: 'How to Score an AMRAP — Rounds Plus Reps, Explained',
    description:
      'An AMRAP score is rounds plus reps, written 7+12. How to count it, what to do about a partial round, the tiebreak rules, and how to record it so it means something later.',
    index: true,
  },
  {
    path: '/guides/what-is-a-good-amrap-score',
    title: 'What Is a Good AMRAP Score? — An Honest Answer',
    description:
      'There is no universal good AMRAP score, and anyone quoting one is guessing. Why the number only means something against the same workout, and how to build your own baseline.',
    index: true,
  },
  {
    path: '/guides/amrap-pacing',
    title: 'AMRAP Pacing — Why the First Round Decides the Score',
    description:
      'Most AMRAPs are lost in the first ninety seconds. How round-time variance predicts your score, what an even split actually looks like, and how to hold one.',
    index: true,
  },
  {
    path: '/guides/group-workouts-remotely',
    title: 'How to Work Out With Friends Remotely',
    description:
      'Training together when you are not in the same room: what actually breaks, why separate timers drift, and how a shared clock and leaderboard fix it.',
    index: true,
  },
  {
    path: '/campaigns',
    title: 'AMRAP Training Campaigns — Benchmark, Train, Retest',
    description:
      'A campaign is a 2 to 12 week AMRAP programme that opens with a benchmark workout and retests it later, so you find out whether the training moved the number.',
    index: true,
  },
  {
    path: '/stats',
    title: 'How 150 AMRAP Workouts Are Built — The Data',
    description:
      'Original data from our workout library: which movements get programmed most, how round density changes with the time cap, and the shape of the long tail.',
    index: true,
  },
  {
    path: '/about',
    title: 'About AMRAP With Friends',
    description:
      'Why AMRAP With Friends exists: every other workout timer is built for one person. This one puts a whole crew on the same clock and the same leaderboard.',
    index: true,
  },
  {
    path: '/privacy',
    title: 'Privacy — AMRAP With Friends',
    description: 'What AMRAP With Friends stores, why, and how to have it deleted.',
    index: true,
  },
  {
    path: '/terms',
    title: 'Terms of Use — AMRAP With Friends',
    description: 'The terms you agree to when you use AMRAP With Friends.',
    index: true,
  },
];

/** Routes served by the React SPA shell. */
export const APP_ROUTES: RouteSeo[] = [
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

/**
 * Generated content pages, as patterns.
 *
 * The pages themselves are enumerated in `contentPages.ts`, which reads the
 * exercise library and the workout templates — far too much data to pull into
 * the edge middleware just to answer "is this a real path". Patterns are enough
 * there: an unknown slug matches the pattern, passes through, and Vercel answers
 * with a real 404 because no file was built for it.
 *
 * The titles are placeholders. Each generated page passes its own title and
 * description to the Astro layout; only `index` and the canonical are read here.
 */
export const DYNAMIC_CONTENT_ROUTES: RouteSeo[] = [
  {
    path: '/exercises/:exerciseSlug',
    title: 'Exercise',
    description: '',
    index: true,
  },
  {
    path: '/amrap-workouts/:duration',
    title: 'AMRAP workouts',
    description: '',
    index: true,
  },
  {
    path: '/amrap-workouts/:duration/:workoutSlug',
    title: 'AMRAP workout',
    description: '',
    index: true,
  },
];

/**
 * Literals first, then app routes, then patterns last — so a real page is never
 * shadowed by a pattern that happens to match at the same depth.
 */
export const ROUTE_SEO: RouteSeo[] = [...CONTENT_ROUTES, ...APP_ROUTES, ...DYNAMIC_CONTENT_ROUTES];

/** True for a `:param` pattern rather than a real URL — never sitemap these. */
export function isRoutePattern(path: string): boolean {
  return path.includes(':');
}

/** True when this path is served by the SPA shell rather than a static page. */
export function isAppRoute(pathname: string): boolean {
  return APP_ROUTES.some((route) => matchRoutePath(route.path, pathname));
}

/**
 * Trailing slashes, repeated slashes and a `.html` suffix are all the same URL
 * to us; the canonical carries none of them. The `.html` case is not theoretical:
 * Astro's file-format build reports `/about.html` as the page's pathname and
 * `/index.html` for the home page, and `cleanUrls` redirects those away in
 * production.
 */
export function normalizePathname(pathname: string): string {
  const withoutQuery = pathname.split(/[?#]/)[0];
  const collapsed = withoutQuery.replace(/\/{2,}/g, '/');
  const withoutSuffix = collapsed.replace(/\.html$/i, '');
  // `/index` is the directory's own document, not a page called "index".
  const withoutIndex = withoutSuffix.replace(/\/index$/i, '/');
  const trimmed = withoutIndex.replace(/\/+$/, '');
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
