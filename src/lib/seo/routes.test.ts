import { describe, it, expect } from 'vitest';
import {
  ROUTE_SEO,
  isRoutePattern,
  SITE_ORIGIN,
  isKnownRoute,
  matchRoutePath,
  normalizePathname,
  resolveSeo,
} from '@/lib/seo/routes';

describe('normalizePathname', () => {
  it('leaves the root alone', () => {
    expect(normalizePathname('/')).toBe('/');
  });

  it('strips trailing slashes, query strings and hashes', () => {
    expect(normalizePathname('/create/')).toBe('/create');
    expect(normalizePathname('/join?m=abc')).toBe('/join');
    expect(normalizePathname('/join#top')).toBe('/join');
  });

  it("treats a .html suffix as the same URL, which is how Astro's build reports it", () => {
    expect(normalizePathname('/about.html')).toBe('/about');
  });

  it('treats /index.html as the root document, which is what Astro reports for the home page', () => {
    expect(normalizePathname('/index.html')).toBe('/');
    expect(normalizePathname('/index')).toBe('/');
  });

  it('collapses repeated slashes and never returns an empty string', () => {
    expect(normalizePathname('//create//')).toBe('/create');
    expect(normalizePathname('')).toBe('/');
  });
});

describe('matchRoutePath', () => {
  it('matches a literal path', () => {
    expect(matchRoutePath('/create', '/create')).toBe(true);
    expect(matchRoutePath('/create', '/created')).toBe(false);
  });

  it('matches exactly one segment per parameter', () => {
    expect(matchRoutePath('/mission/:missionId', '/mission/abc-123')).toBe(true);
    expect(matchRoutePath('/mission/:missionId', '/mission')).toBe(false);
    expect(matchRoutePath('/mission/:missionId', '/mission/abc/extra')).toBe(false);
  });

  it('prefers the literal route over the parameterised one at the same depth', () => {
    // `/campaign/join` and `/campaign/:campaignId` are both two segments; the
    // invite page must not be resolved as a campaign id.
    expect(resolveSeo('/campaign/join').title).toBe("You've been invited");
  });

  it('matches blog category hubs before post slugs', () => {
    expect(resolveSeo('/blog/category/programming').title).toBe('Blog category');
    expect(resolveSeo('/blog/why-easy-days-matter').title).toBe('Blog post');
  });
});

describe('resolveSeo', () => {
  it('gives an indexable route a self-referencing canonical', () => {
    const seo = resolveSeo('/create');
    expect(seo.canonical).toBe(`${SITE_ORIGIN}/create`);
    expect(seo.robots).toBe('index, follow');
    expect(seo.known).toBe(true);
  });

  it('canonicalises away a trailing slash rather than pointing at the homepage', () => {
    expect(resolveSeo('/create/').canonical).toBe(`${SITE_ORIGIN}/create`);
  });

  it('resolves the pathname Astro reports for a statically built page', () => {
    const seo = resolveSeo('/amrap-timer.html');
    expect(seo.known).toBe(true);
    expect(seo.canonical).toBe(`${SITE_ORIGIN}/amrap-timer`);
  });

  it('drops the canonical on noindex routes', () => {
    const seo = resolveSeo('/rally-point/abc-123');
    expect(seo.canonical).toBeNull();
    expect(seo.robots).toBe('noindex, follow');
  });

  it('keeps every private and ephemeral surface out of the index', () => {
    const noindexed = [
      '/rally-point/abc',
      '/mission/abc',
      '/campaign/abc',
      '/campaign/new',
      '/squad',
      '/my-missions',
      '/intake',
      '/hud',
      '/coach',
      '/coach/wods',
      '/coach/articles',
    ];
    for (const path of noindexed) {
      expect(resolveSeo(path).robots, path).toBe('noindex, follow');
    }
  });

  it('reports an unknown path so the caller can 404 instead of serving an empty shell', () => {
    const seo = resolveSeo('/not-a-real-page');
    expect(seo.known).toBe(false);
    expect(seo.canonical).toBeNull();
    expect(isKnownRoute('/not-a-real-page')).toBe(false);
  });

  it('falls back to the site description when a route has none of its own', () => {
    expect(resolveSeo('/squad').description).toBe(resolveSeo('/').description);
  });
});

describe('ROUTE_SEO', () => {
  it('gives every indexable page a title and description of its own', () => {
    // Pattern rows carry placeholders: each generated page passes its own title
    // and description to the Astro layout.
    for (const route of ROUTE_SEO.filter((r) => r.index && !isRoutePattern(r.path))) {
      expect(route.title, route.path).not.toBe('');
      expect(route.description, route.path).not.toBe('');
    }
  });

  it('has no duplicate patterns', () => {
    const paths = ROUTE_SEO.map((route) => route.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('gives each indexable page a distinct title, so no two URLs compete', () => {
    const titles = ROUTE_SEO.filter((r) => r.index && !isRoutePattern(r.path)).map((r) => r.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('keeps hand-written indexable descriptions in the 50–160 character band Bing expects', () => {
    for (const route of ROUTE_SEO.filter((r) => r.index && !isRoutePattern(r.path))) {
      expect(route.description.length, route.path).toBeGreaterThanOrEqual(50);
      expect(route.description.length, route.path).toBeLessThanOrEqual(160);
    }
  });
});
