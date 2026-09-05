import { describe, it, expect } from 'vitest';
import { ROUTE_SEO, SITE_ORIGIN, isRoutePattern, resolveSeo } from '@/lib/seo/routes';
import { generatedContentPages } from '@/lib/seo/contentPages';
import { blogCategoryHubPaths, blogPostPaths, listCommittedBlogPosts } from '@/lib/seo/blogPosts';
import { buildLlmsTxt, buildSitemapXml, indexableUrls } from '@/lib/seo/sitemap';

describe('indexableUrls', () => {
  it('lists the hand-written pages followed by every generated one and committed blog posts', () => {
    const fixed = ROUTE_SEO.filter((route) => route.index && !isRoutePattern(route.path)).map(
      (route) => `${SITE_ORIGIN}${route.path}`
    );
    const generated = generatedContentPages().map((page) => `${SITE_ORIGIN}${page.path}`);
    const posts = listCommittedBlogPosts();
    const blog = [...blogPostPaths(posts), ...blogCategoryHubPaths(posts)].map(
      (path) => `${SITE_ORIGIN}${path}`
    );
    expect(indexableUrls()).toEqual([...fixed, ...generated, ...blog]);
  });

  it('never lists a route pattern, which is not a URL', () => {
    for (const url of indexableUrls()) {
      expect(url.startsWith(`${SITE_ORIGIN}/`), url).toBe(true);
      // The scheme's own colon is the only one a real URL has here.
      expect(url.slice(SITE_ORIGIN.length), url).not.toContain(':');
    }
  });

  it('includes the generated workout and exercise pages', () => {
    const urls = indexableUrls();
    expect(urls).toContain(`${SITE_ORIGIN}/exercises/burpees`);
    expect(urls.some((url) => url.includes('/amrap-workouts/5-minute/'))).toBe(true);
    expect(urls).toContain(`${SITE_ORIGIN}/amrap-workouts/style/engine-room`);
  });

  it('matches the canonical each page declares, so the two cannot disagree', () => {
    const urls = indexableUrls();
    for (const route of ROUTE_SEO.filter((r) => r.index && !isRoutePattern(r.path))) {
      expect(urls, route.path).toContain(resolveSeo(route.path).canonical);
    }
    // A generated page's canonical comes from the pattern row it matches.
    for (const page of generatedContentPages()) {
      expect(resolveSeo(page.path).canonical, page.path).toBe(`${SITE_ORIGIN}${page.path}`);
      expect(resolveSeo(page.path).robots, page.path).toBe('index, follow');
    }
  });

  it('includes the static content pages Astro builds', () => {
    const urls = indexableUrls();
    expect(urls).toContain(`${SITE_ORIGIN}/amrap-timer`);
    expect(urls).toContain(`${SITE_ORIGIN}/about`);
    expect(urls).toContain(`${SITE_ORIGIN}/blog`);
  });

  it('excludes every noindex route', () => {
    const urls = indexableUrls();
    for (const route of ROUTE_SEO.filter((r) => !r.index)) {
      expect(urls, route.path).not.toContain(`${SITE_ORIGIN}${route.path}`);
    }
  });

  it('has no duplicates', () => {
    const urls = indexableUrls();
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe('buildSitemapXml', () => {
  const xml = buildSitemapXml();

  it('is a well-formed urlset listing every indexable URL once', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    expect(locs).toEqual(indexableUrls());
  });

  it('never lists a noindex route', () => {
    expect(xml).not.toContain('/rally-point');
    expect(xml).not.toContain('/hud');
  });
});

describe('buildLlmsTxt', () => {
  // Deliberately the hand-written pages only: a hundred generated URLs is a
  // sitemap, and this file is meant to be read.
  const fixed = ROUTE_SEO.filter(
    (route) => route.index && !isRoutePattern(route.path) && route.description
  );

  it('links every hand-written page with its description', () => {
    const txt = buildLlmsTxt();
    for (const route of fixed) {
      expect(txt, route.path).toContain(`(${SITE_ORIGIN}${route.path})`);
    }
  });

  it('does not try to enumerate the generated pages', () => {
    const txt = buildLlmsTxt();
    expect(txt).not.toContain('/exercises/burpees');
  });
});
