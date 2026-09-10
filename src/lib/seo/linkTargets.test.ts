import { globSync, readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { CONTENT_ROUTES, matchRoutePath } from '@/lib/seo/routes';

/**
 * A `<Link>` can only reach a route the SPA serves. Astro builds the content
 * pages, so a `<Link to="/about">` would push a history entry that renders the
 * 404 page instead of navigating — and nothing else would catch it. Those links
 * have to be `<AppLink>`, which falls back to a real navigation.
 */
describe('react-router Link targets', () => {
  const files = globSync('src/**/*.tsx').filter((file) => !file.endsWith('.test.tsx'));

  it('finds source files to check', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('never points a Link at a page Astro builds', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/<Link\b[^>]*?\sto="([^"{]+)"/gs)) {
        const target = match[1].split(/[?#]/)[0];
        if (CONTENT_ROUTES.some((route) => matchRoutePath(route.path, target))) {
          offenders.push(`${file} → ${target}`);
        }
      }
    }

    expect(offenders, 'use <AppLink> for these targets').toEqual([]);
  });
});
