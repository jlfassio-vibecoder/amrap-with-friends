import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { ROUTE_SEO, SITE_ORIGIN } from '@/lib/seo/routes';

/**
 * The sitemap is hand-maintained until the content layer lands and generates it.
 * Until then this is the guard: a route that becomes indexable, or stops being,
 * has to be reflected in public/sitemap.xml or CI fails.
 */
describe('public/sitemap.xml', () => {
  const xml = readFileSync('public/sitemap.xml', 'utf8');
  const listed = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

  it('lists exactly the indexable routes', () => {
    const expected = ROUTE_SEO.filter((route) => route.index).map(
      (route) => `${SITE_ORIGIN}${route.path}`
    );
    expect([...listed].sort()).toEqual([...expected].sort());
  });

  it('lists no route that is noindexed', () => {
    const noindexed = ROUTE_SEO.filter((route) => !route.index).map(
      (route) => `${SITE_ORIGIN}${route.path}`
    );
    for (const url of noindexed) {
      expect(listed, url).not.toContain(url);
    }
  });

  it('has no duplicate entries', () => {
    expect(new Set(listed).size).toBe(listed.length);
  });
});
