import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `coach_users` is the platform owner's allowlist. It gates /coach, which
 * carries conversion and web analytics for the whole product.
 *
 * A paying host must never acquire it, and the way that would happen is not a
 * decision -- it is a later change reaching for the allowlist because it is
 * the authorization check already lying around. Room code has its own:
 * `room_role()` on the row's own room_id.
 *
 * The exceptions are deliberate, enumerated below, and both are the same kind
 * of thing: the platform owner acting on rooms as the platform, rather than a
 * host acting on their own room.
 *
 * - `grant_room_entitlement` — giving a room free access is an AWF decision,
 *   not a host's.
 * - `list_rooms_for_admin` — the read behind that screen. It returns every
 *   host's room and their owner's email address, so `room_role` would be the
 *   wrong check: there is no single room it is scoped to.
 *
 * Nothing else in rooms may. Adding a third entry here should feel like a
 * decision, because the failure this guards against is a later change reaching
 * for the allowlist as the authorization check already lying around.
 */

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations');
// Every room migration, not only the ones that happen to be named
// `coach_rooms`. The reserved-handles migration redefines create_room and was
// invisible to this guard until Copilot pointed it out.
const ROOM_MIGRATION = /coach_rooms|room_handles|_room/;
const ALLOWED_IN = ['grant_room_entitlement', 'list_rooms_for_admin'] as const;

function roomMigrations(): { name: string; sql: string }[] {
  return readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql') && ROOM_MIGRATION.test(name))
    .map((name) => ({ name, sql: readFileSync(join(MIGRATIONS, name), 'utf8') }));
}

/** The SQL between one CREATE FUNCTION and the next, so a hit can be attributed. */
function functionBodies(sql: string): { name: string; body: string }[] {
  const bodies: { name: string; body: string }[] = [];
  const pattern = /CREATE OR REPLACE FUNCTION public\.([a-z_]+)/g;
  const starts: { name: string; at: number }[] = [];
  let match = pattern.exec(sql);
  while (match !== null) {
    starts.push({ name: match[1]!, at: match.index });
    match = pattern.exec(sql);
  }
  for (let index = 0; index < starts.length; index += 1) {
    const from = starts[index]!;
    const to = starts[index + 1]?.at ?? sql.length;
    bodies.push({ name: from.name, body: sql.slice(from.at, to) });
  }
  return bodies;
}

describe('rooms never widen the platform coach role', () => {
  it('finds the room migrations to check', () => {
    expect(roomMigrations().length).toBeGreaterThan(0);
  });

  it('references coach_users only inside the named exceptions', () => {
    const offenders: string[] = [];

    for (const migration of roomMigrations()) {
      for (const fn of functionBodies(migration.sql)) {
        if ((ALLOWED_IN as readonly string[]).includes(fn.name)) {
          continue;
        }
        if (/\bcoach_users\b/.test(stripComments(fn.body))) {
          offenders.push(`${migration.name}:${fn.name}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it.each(ALLOWED_IN)(
    'still checks coach_users inside %s, so this cannot pass by the check disappearing',
    (name) => {
      // The exception list is only safe while each entry actually performs the
      // check. An allowlisted function that quietly stopped checking would be
      // invisible to the test above -- it is skipped either way.
      // The last definition wins: these functions are redefined by later
      // migrations, and an earlier copy still carrying the check would hide a
      // newer one that dropped it.
      const fn = roomMigrations()
        .flatMap((migration) => functionBodies(migration.sql))
        .filter((candidate) => candidate.name === name)
        .pop();

      expect(fn).toBeDefined();
      expect(/\bcoach_users\b/.test(stripComments(fn!.body))).toBe(true);
    }
  );
});

/** Comments explaining the rule mention the table; they are not uses of it. */
function stripComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, '');
}
