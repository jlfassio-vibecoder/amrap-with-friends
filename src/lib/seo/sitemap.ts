import { ROUTE_SEO, SITE_ORIGIN, normalizePathname } from '@/lib/seo/routes';

/** Absolute URLs for every route we want in the index, in table order. */
export function indexableUrls(): string[] {
  return ROUTE_SEO.filter((route) => route.index).map(
    (route) => `${SITE_ORIGIN}${normalizePathname(route.path)}`
  );
}

/**
 * Generated at build time rather than hand-maintained: a hand-written sitemap
 * drifts the moment a route's index policy changes, and it changes silently.
 */
export function buildSitemapXml(): string {
  const urls = indexableUrls()
    .map((url) => `  <url>\n    <loc>${url}</loc>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

/**
 * A community proposal, not a standard: no major model provider has committed
 * to reading it, and measured traffic to it is negligible. It costs one build
 * step, so we ship it and expect nothing. Do not spend time tuning it.
 */
export function buildLlmsTxt(): string {
  const lines = ROUTE_SEO.filter((route) => route.index).map(
    (route) =>
      `- [${route.title}](${SITE_ORIGIN}${normalizePathname(route.path)}): ${route.description}`
  );
  return `# AMRAP With Friends

> A live group workout timer for AMRAP (As Many Rounds As Possible) training.
> Host or join a mission, everyone runs the same synced countdown, and the
> leaderboard updates in real time.

## Pages

${lines.join('\n')}
`;
}
