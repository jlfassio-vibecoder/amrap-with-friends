import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { allTimeCaps } from '@/lib/timeDomains';
import {
  MAX_CHAIN_LENGTH,
  MAX_REST_SEC,
  MIN_REST_SEC,
  restAfterMissionSec,
  type ChainMission,
} from '@/lib/mission/chainRest';
import {
  isPlausibleRallyPointCountdownEndsAt,
  RALLY_POINT_COUNTDOWN_MAX_SECONDS,
} from '@/lib/mission/rallyPointCountdown';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const migration = readFileSync(
  join(root, 'supabase/migrations/20260908100000_mission_chains.sql'),
  'utf8'
);

/**
 * Rebuild `chain_rest_seconds` from the migration's own text.
 *
 * The rest table exists twice — in TypeScript so the builder can preview it,
 * and in SQL because that is what arms the countdown inside the transaction
 * that creates the mission. Two copies of one rule is the drift this codebase
 * has already paid for once, so rather than assert a few strings match, this
 * parses the numbers out of the migration and runs both implementations over
 * every input the product can produce.
 */
function parseSqlRestFunction(): (cap: number, tier: number | null) => number {
  const body = /CREATE OR REPLACE FUNCTION public\.chain_rest_seconds[\s\S]*?\$function\$;/.exec(
    migration
  );
  expect(body, 'chain_rest_seconds is missing from the migration').not.toBeNull();
  const sql = body![0];

  const bases = [
    ...sql.matchAll(/WHEN p_duration_minutes BETWEEN (\d+) AND (\d+) THEN (\d+)/g),
  ].map((match) => ({ min: Number(match[1]), max: Number(match[2]), rest: Number(match[3]) }));
  expect(bases.length, 'expected one base arm per time domain').toBe(4);

  const highTier = /WHEN p_intensity_tier >= (\d+) THEN (-?\d+)/.exec(sql);
  const lowTier = /WHEN p_intensity_tier <= (\d+) THEN (-?\d+)/.exec(sql);
  const clamp = /least\(greatest\(v_base \+ v_adjust, (\d+)\), (\d+)\)/.exec(sql);
  expect(highTier).not.toBeNull();
  expect(lowTier).not.toBeNull();
  expect(clamp).not.toBeNull();

  const floor = Number(clamp![1]);
  const ceiling = Number(clamp![2]);

  return (cap, tier) => {
    const base = bases.find((arm) => cap >= arm.min && cap <= arm.max);
    if (!base) {
      throw new Error(`No time domain for a ${cap}-minute mission`);
    }
    let adjust = 0;
    if (tier !== null) {
      if (tier >= Number(highTier![1])) {
        adjust = Number(highTier![2]);
      } else if (tier <= Number(lowTier![1])) {
        adjust = Number(lowTier![2]);
      }
    }
    return Math.min(Math.max(base.rest + adjust, floor), ceiling);
  };
}

const TIERS: Array<number | null> = [null, 1, 2, 3, 4, 5];

describe('chain_rest_seconds contract', () => {
  const sqlRest = parseSqlRestFunction();

  it('agrees with chainRest.ts for every cap and tier the product can produce', () => {
    for (const cap of allTimeCaps()) {
      for (const tier of TIERS) {
        const mission: ChainMission = { durationMinutes: cap, intensityTier: tier };
        expect(sqlRest(cap, tier), `SQL and TypeScript disagree at ${cap} min, tier ${tier}`).toBe(
          restAfterMissionSec(mission)
        );
      }
    }
  });

  it('shares the same clamp on both sides', () => {
    const clamp = /least\(greatest\(v_base \+ v_adjust, (\d+)\), (\d+)\)/.exec(migration);
    expect(Number(clamp![1])).toBe(MIN_REST_SEC);
    expect(Number(clamp![2])).toBe(MAX_REST_SEC);
  });

  it('bounds the chain to the same length in the table, the RPC and the module', () => {
    const positionCheck = /position BETWEEN 0 AND (\d+)/.exec(migration);
    const rpcCheck = /A chain holds at most (\d+) missions/.exec(migration);
    expect(positionCheck).not.toBeNull();
    expect(rpcCheck).not.toBeNull();
    expect(Number(positionCheck![1])).toBe(MAX_CHAIN_LENGTH - 1);
    expect(Number(rpcCheck![1])).toBe(MAX_CHAIN_LENGTH);
  });

  it('refuses an unclaimed minute on both sides', () => {
    for (const cap of [6, 11, 16, 17, 30]) {
      expect(() => sqlRest(cap, null)).toThrow();
      expect(() => restAfterMissionSec({ durationMinutes: cap })).toThrow();
    }
  });
});

describe('the armed rest survives the client-side plausibility guard', () => {
  it('is not mistaken for a stray far-future ends_at', () => {
    // `isPlausibleRallyPointCountdownEndsAt` deliberately rejects an ends_at too
    // far ahead to have come from set_rally_point_countdown, so that a stray
    // value does not render as a T-minus clock. A chained rest is written by a
    // different RPC, and this is the assertion that it still reads as a real
    // countdown rather than being silently ignored.
    const now = Date.UTC(2026, 8, 8, 12, 0, 0);
    for (const cap of allTimeCaps()) {
      for (const tier of TIERS) {
        const rest = restAfterMissionSec({ durationMinutes: cap, intensityTier: tier });
        const endsAt = new Date(now + rest * 1000).toISOString();
        expect(
          isPlausibleRallyPointCountdownEndsAt(endsAt, now),
          `a ${rest}s rest should read as an armed countdown`
        ).toBe(true);
      }
    }
  });

  it('stays inside the countdown RPC ceiling it shares', () => {
    expect(MAX_REST_SEC).toBe(RALLY_POINT_COUNTDOWN_MAX_SECONDS);
  });
});
