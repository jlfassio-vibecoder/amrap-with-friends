import { describe, it, expect } from 'vitest';
import { ROUTE_SEO, SITE_ORIGIN, resolveSeo } from '@/lib/seo/routes';
import { buildLlmsTxt, buildSitemapXml, indexableUrls } from '@/lib/seo/sitemap';

describe('indexableUrls', () => {
  it('lists exactly the indexable routes as absolute URLs', () => {
    const expected = ROUTE_SEO.filter((route) => route.index).map(
      (route) => `${SITE_ORIGIN}${route.path}`
    );
    expect(indexableUrls()).toEqual(expected);
  });

  it('matches the canonical the page itself declares, so the two cannot disagree', () => {
    for (const route of ROUTE_SEO.filter((r) => r.index)) {
      expect(indexableUrls(), route.path).toContain(resolveSeo(route.path).canonical);
    }
  });

  it('includes the static content pages Astro builds', () => {
    const urls = indexableUrls();
    expect(urls).toContain(`${SITE_ORIGIN}/amrap-timer`);
    expect(urls).toContain(`${SITE_ORIGIN}/about`);
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
  it('links every indexable page with its description', () => {
    const txt = buildLlmsTxt();
    for (const url of indexableUrls()) {
      expect(txt, url).toContain(`(${url})`);
    }
  });
});
