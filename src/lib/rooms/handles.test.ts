import { describe, it, expect } from 'vitest';
import {
  checkHandle,
  handleRejectionMessage,
  HANDLE_MAX,
  HANDLE_MIN,
  RESERVED_WORDS,
  reservedHandles,
  routeFirstSegments,
} from './handles';
import { ROUTE_SEO } from '@/lib/seo/routes';

describe('checkHandle', () => {
  it('accepts an ordinary handle and returns it normalized', () => {
    expect(checkHandle('CoachMaya')).toEqual({ ok: true, handle: 'coachmaya' });
    expect(checkHandle('  bay_area_crossfit  ')).toEqual({
      ok: true,
      handle: 'bay_area_crossfit',
    });
  });

  it('rejects handles outside the length bounds', () => {
    expect(checkHandle('ab')).toEqual({ ok: false, reason: 'too_short' });
    expect(checkHandle('a'.repeat(HANDLE_MAX + 1))).toEqual({ ok: false, reason: 'too_long' });
    expect(checkHandle('a'.repeat(HANDLE_MIN)).ok).toBe(true);
    expect(checkHandle('a'.repeat(HANDLE_MAX)).ok).toBe(true);
  });

  it('rejects characters that would not survive a URL', () => {
    for (const bad of ['coach maya', 'coach-maya', 'coach.maya', 'coach/maya', 'coach@maya']) {
      expect(checkHandle(bad)).toEqual({ ok: false, reason: 'bad_shape' });
    }
  });

  it('rejects a leading underscore, so a handle always starts with something readable', () => {
    expect(checkHandle('_coach')).toEqual({ ok: false, reason: 'bad_shape' });
  });

  // Case is not a way past the reserved list: /@Coach and /@coach are one URL.
  it('reserves a word however it is capitalized', () => {
    expect(checkHandle('admin')).toEqual({ ok: false, reason: 'reserved' });
    expect(checkHandle('ADMIN')).toEqual({ ok: false, reason: 'reserved' });
    expect(checkHandle('Support')).toEqual({ ok: false, reason: 'reserved' });
  });

  it('reserves the first segment of a route the app already answers', () => {
    expect(checkHandle('blog')).toEqual({ ok: false, reason: 'reserved' });
    expect(checkHandle('creators')).toEqual({ ok: false, reason: 'reserved' });
    expect(checkHandle('mission')).toEqual({ ok: false, reason: 'reserved' });
    expect(checkHandle('exercises')).toEqual({ ok: false, reason: 'reserved' });
  });
});

describe('the reserved list tracks the router', () => {
  /**
   * The one that matters. A route added later that a host could already have
   * claimed is a permanent collision -- taking the handle back breaks their
   * links, leaving it breaks the route -- and nothing else would catch it.
   */
  it('reserves every first path segment in ROUTE_SEO', () => {
    const reserved = reservedHandles();
    const unreserved = routeFirstSegments().filter((segment) => !reserved.has(segment));
    expect(unreserved).toEqual([]);
  });

  it('derives those segments from the routes rather than a copied list', () => {
    // `/s/:shareId` is registered for the middleware; its segment must be reserved.
    expect(routeFirstSegments()).toContain('s');
    expect(ROUTE_SEO.some((route) => route.path.startsWith('/s/'))).toBe(true);
  });

  it('ignores the root route, which has no segment to reserve', () => {
    expect(routeFirstSegments()).not.toContain('');
  });

  it('keeps the hand-written words as well as the routed ones', () => {
    const reserved = reservedHandles();
    for (const word of RESERVED_WORDS) {
      expect(reserved.has(word)).toBe(true);
    }
  });
});

describe('handleRejectionMessage', () => {
  it('tells the host what to do next, not just that they were wrong', () => {
    expect(handleRejectionMessage('too_short')).toContain(String(HANDLE_MIN));
    expect(handleRejectionMessage('too_long')).toContain(String(HANDLE_MAX));
    expect(handleRejectionMessage('bad_shape')).toMatch(/lowercase letters/);
    expect(handleRejectionMessage('reserved')).toMatch(/Try adding/);
  });
});
