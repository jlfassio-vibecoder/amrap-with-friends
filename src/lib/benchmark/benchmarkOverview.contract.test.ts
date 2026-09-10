import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const overview = readFileSync(
  join(root, 'supabase/migrations/20260909250000_benchmark_overview.sql'),
  'utf8'
);
const dropSchedule = readFileSync(
  join(root, 'supabase/migrations/20260909260000_my_campaigns_drop_schedule.sql'),
  'utf8'
);

/**
 * `benchmark_overview` exists to make deriving attempts cheap. These pin the
 * properties that make it cheap, and the ones that make it safe — both of which
 * a later "just add one more field" would quietly undo.
 */
describe('benchmark_overview', () => {
  it('scopes every branch to the caller', () => {
    // Three queries, three user filters. A missing one would return another
    // athlete's benchmarks or scores through a SECURITY DEFINER function.
    expect(overview).toContain('v_uid := auth.uid();');
    expect(overview).toContain("RAISE EXCEPTION 'Authentication required'");
    expect(overview.match(/user_id = v_uid/g) ?? []).toHaveLength(3);
  });

  it('carries only the columns an attempt needs', () => {
    // Anchored on the comment, not on INTO: in plpgsql the select list sits
    // before INTO, so an INTO-anchored block contains no columns at all and
    // every assertion against it would pass vacuously.
    const attemptBlock =
      /-- Every scored mission of the caller's[\s\S]*?AND psr\.final_score IS NOT NULL;/.exec(
        overview
      );
    expect(attemptBlock, 'the attempts query is missing').not.toBeNull();

    // The point of the function: none of my_missions' expensive columns.
    for (const expensive of ['workout', 'score_breakdown', 'coach_workouts', 'chain_item']) {
      expect(attemptBlock![0]).not.toContain(expensive);
    }
  });

  it('makes attempts opt-in, so the rally point does not pay for them', () => {
    expect(overview).toContain(
      'CREATE OR REPLACE FUNCTION public.benchmark_overview(p_include_attempts boolean DEFAULT false)'
    );
    expect(overview).toMatch(/IF p_include_attempts THEN/);
  });

  it('leaves unscored missions out of the count as well as the series', () => {
    expect(overview).toContain('AND psr.final_score IS NOT NULL');
  });

  it('ships only live campaigns, and their schedules raw', () => {
    // In plpgsql the select list sits before INTO, so the block runs from the
    // start of the campaign query to the attempts branch.
    const campaignBlock = /-- Live campaigns only[\s\S]*?IF p_include_attempts THEN/.exec(overview);
    expect(campaignBlock, 'the campaigns query is missing').not.toBeNull();

    expect(campaignBlock![0]).toContain("WHERE c.status NOT IN ('complete', 'abandoned')");
    expect(campaignBlock![0]).toContain("'week_number', o.week_number");
    // Raw, not resolved: which occurrence is the benchmark stays
    // deriveCampaignRoles's call, and shipping the answer from here would be a
    // second copy of a tested rule.
    expect(campaignBlock![0]).not.toContain('sequence = 1');
    expect(campaignBlock![0]).not.toContain('LIMIT 1');
    expect(campaignBlock![0]).not.toMatch(/benchmark/i);
  });

  it('is granted to authenticated only', () => {
    expect(overview).toContain(
      'REVOKE EXECUTE ON FUNCTION public.benchmark_overview(boolean) FROM PUBLIC, anon;'
    );
    expect(overview).toContain(
      'GRANT EXECUTE ON FUNCTION public.benchmark_overview(boolean) TO authenticated;'
    );
  });

  it('takes the schedule back off my_campaigns, which no longer reads it', () => {
    expect(dropSchedule).toContain('CREATE OR REPLACE FUNCTION public.my_campaigns');
    expect(dropSchedule).not.toContain('AS schedule');
  });
});
