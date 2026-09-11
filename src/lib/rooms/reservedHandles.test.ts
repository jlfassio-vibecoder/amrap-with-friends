import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { reservedHandles } from './handles';

/**
 * The app's reserved list and the database's must not drift.
 *
 * They exist in two places for a reason: `checkHandle()` tells a host why their
 * handle was refused before they submit, and the `reserved_handles` table is
 * what actually stops them. Phase 1 shipped with only the first, and running
 * the RPC directly claimed /@blog, /@coach, /@admin and /@creators.
 *
 * So this fails when a route is added to ROUTE_SEO without a migration seeding
 * its segment. The fix when it fails is a new migration, never an edit to an
 * applied one.
 */

const MIGRATION = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260911220000_reserved_room_handles.sql'
);

/** The handles the migration seeds, read out of its INSERT ... VALUES block. */
function seededHandles(): Set<string> {
  const sql = readFileSync(MIGRATION, 'utf8');
  const insert = sql.slice(sql.indexOf('INSERT INTO public.reserved_handles'));
  const values = insert.slice(0, insert.indexOf('ON CONFLICT'));
  return new Set([...values.matchAll(/\('([a-z0-9_]+)'\)/g)].map((match) => match[1]!));
}

/** A segment that could never pass the handle shape cannot be claimed anyway. */
const CLAIMABLE = /^[a-z0-9][a-z0-9_]{2,23}$/;

describe('reserved handles are enforced in the database, not only the app', () => {
  it('seeds something', () => {
    expect(seededHandles().size).toBeGreaterThan(30);
  });

  it('seeds every claimable handle the app reserves', () => {
    const seeded = seededHandles();
    const missing = [...reservedHandles()]
      .filter((handle) => CLAIMABLE.test(handle))
      .filter((handle) => !seeded.has(handle))
      .sort();

    expect(missing).toEqual([]);
  });

  it('covers the four that were actually claimable in production', () => {
    const seeded = seededHandles();
    for (const handle of ['blog', 'coach', 'admin', 'creators']) {
      expect(seeded.has(handle)).toBe(true);
    }
  });

  it('does not seed a handle the shape rule would reject anyway', () => {
    for (const handle of seededHandles()) {
      expect(CLAIMABLE.test(handle)).toBe(true);
    }
  });
});
