import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_ROUTES, DYNAMIC_APP_ROUTES } from '@/lib/seo/routes';

/**
 * routes.ts and vercel.json have to agree about which paths are the SPA.
 *
 * They govern different halves of the same request: routes.ts decides whether
 * the edge middleware answers with a 404, and vercel.json decides whether the
 * path is rewritten onto the app shell. Registering a route in one and not the
 * other produces the confusing case that shipped — a crawler got a correct
 * link preview for /s/:shareId while a human following the same link got a
 * 404, because only the middleware knew about it.
 */
const rewrites: { source: string; destination: string }[] = JSON.parse(
  readFileSync('vercel.json', 'utf8')
).rewrites;

const rewriteSources = new Set(rewrites.map((rewrite) => rewrite.source));

describe('SPA routes and vercel rewrites', () => {
  it('rewrites every SPA route onto the app shell', () => {
    const missing = [...APP_ROUTES, ...DYNAMIC_APP_ROUTES]
      .map((route) => route.path)
      .filter((path) => !rewriteSources.has(path));
    expect(missing).toEqual([]);
  });

  it('does not rewrite a path no SPA route claims', () => {
    // The other direction: a rewrite with no route sends a real URL to an app
    // shell that will not render it.
    const known = new Set([...APP_ROUTES, ...DYNAMIC_APP_ROUTES].map((route) => route.path));
    expect(rewrites.map((r) => r.source).filter((source) => !known.has(source))).toEqual([]);
  });

  it('sends them all to the same shell', () => {
    expect([...new Set(rewrites.map((rewrite) => rewrite.destination))]).toEqual(['/_app-shell']);
  });

  it('found rewrites to check', () => {
    // Guards the guard: a moved or renamed vercel.json would otherwise make
    // every assertion above pass over an empty list.
    expect(rewrites.length).toBeGreaterThan(10);
  });
});
