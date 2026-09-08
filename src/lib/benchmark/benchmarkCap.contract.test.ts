import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TIME_DOMAINS } from '@/data/workoutTemplates';
import { MAX_ACTIVE_BENCHMARKS } from '@/lib/benchmark/benchmarkCap';
import { MAX_TIME_CAP, MIN_TIME_CAP, capsForDomain } from '@/lib/timeDomains';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const migration = readFileSync(
  join(root, 'supabase/migrations/20260909210000_athlete_benchmarks.sql'),
  'utf8'
);

/**
 * The cap exists twice: in TypeScript, where the UI decides whether to offer
 * the control, and in SQL, where the insert actually has to hold.
 *
 * They are allowed to differ in one specific way — SQL does not know about
 * campaign benchmarks, for the reason written at the call site — but everything
 * they do share has to agree. A number that drifts here does not error; it just
 * lets an athlete keep one benchmark more than the product says they can, which
 * nobody would notice until the HUD card stopped fitting.
 */
describe('the SQL floor matches the TypeScript cap', () => {
  it('stops at the same number of active benchmarks', () => {
    const limit =
      /IF v_active >= (\d+) THEN\s+RETURN jsonb_build_object\('ok',\s+false,\s+'reason',\s+'at_limit'\)/.exec(
        migration
      );
    expect(limit, 'the at_limit guard is missing').not.toBeNull();
    expect(Number(limit![1])).toBe(MAX_ACTIVE_BENCHMARKS);
  });

  it('recognises the same four time domains', () => {
    const check =
      /CONSTRAINT athlete_benchmarks_domain_valid CHECK \(time_domain IN \(([^)]+)\)\)/.exec(
        migration
      );
    expect(check, 'the domain CHECK is missing').not.toBeNull();
    const sqlDomains = check![1].split(',').map((part) => Number(part.trim()));
    expect(sqlDomains).toEqual([...TIME_DOMAINS]);
  });

  it('accepts exactly the clocks the library offers', () => {
    const range = /CONSTRAINT athlete_benchmarks_duration_range CHECK \(([\s\S]*?)\n {2}\)/.exec(
      migration
    );
    expect(range, 'the duration CHECK is missing').not.toBeNull();

    const arms = [...range![1].matchAll(/duration_minutes BETWEEN (\d+) AND (\d+)/g)].map(
      (match) => ({ min: Number(match[1]), max: Number(match[2]) })
    );
    expect(arms).toHaveLength(TIME_DOMAINS.length);

    const accepts = (cap: number) => arms.some((arm) => cap >= arm.min && cap <= arm.max);

    for (const domain of TIME_DOMAINS) {
      for (const cap of capsForDomain(domain)) {
        expect(accepts(cap), `SQL rejects the legal cap ${cap}`).toBe(true);
      }
    }
    // The gaps between domains, which have no domain to hold a slot.
    for (const cap of [6, 11, 16, 17]) {
      expect(accepts(cap), `SQL accepts the gap cap ${cap}`).toBe(false);
    }
    for (const cap of [MIN_TIME_CAP - 1, MAX_TIME_CAP + 1]) {
      expect(accepts(cap), `SQL accepts the out-of-range cap ${cap}`).toBe(false);
    }
  });

  it('refuses a coach workout, the same rule isBenchmarkableTemplate applies', () => {
    expect(migration).toContain("IF v_template LIKE 'coach:%' THEN");
    expect(migration).toContain("'reason', 'coach_workout'");
  });

  it('enforces one live benchmark per domain in an index, not only in a check', () => {
    // Two concurrent designates both pass a SELECT-then-INSERT check. Only the
    // partial unique index actually stops the second one.
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX[\s\S]*?ON public\.athlete_benchmarks \(user_id, time_domain\)\s+WHERE retired_at IS NULL/
    );
    expect(migration).toContain('WHEN unique_violation THEN');
  });

  it('locks the table down like every other table in this schema', () => {
    expect(migration).toContain('ALTER TABLE public.athlete_benchmarks ENABLE ROW LEVEL SECURITY;');
    expect(migration).toContain(
      'REVOKE ALL ON public.athlete_benchmarks FROM PUBLIC, anon, authenticated;'
    );
  });

  it('grants each RPC to authenticated only', () => {
    for (const signature of [
      'public.designate_benchmark(text, int, int, text)',
      'public.retire_benchmark(uuid)',
      'public.my_benchmarks()',
    ]) {
      expect(migration).toContain(`REVOKE EXECUTE ON FUNCTION ${signature} FROM PUBLIC, anon;`);
      expect(migration).toContain(`GRANT EXECUTE ON FUNCTION ${signature} TO authenticated;`);
    }
  });
});
