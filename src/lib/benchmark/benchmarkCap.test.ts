import { describe, expect, it } from 'vitest';
import { MAX_CAMPAIGN_TESTS } from '@/lib/campaign/constants';
import {
  MAX_ACTIVE_BENCHMARKS,
  activeBenchmarkCount,
  benchmarkOccupancy,
  canDesignateBenchmark,
  isBenchmarkableTemplate,
  type BenchmarkSlot,
} from '@/lib/benchmark/benchmarkCap';

const personal = (domain: 5 | 10 | 15 | 20, templateId = 'the-valve'): BenchmarkSlot => ({
  domain,
  source: 'personal',
  templateId,
});

const campaign = (domain: 5 | 10 | 15 | 20): BenchmarkSlot => ({
  domain,
  source: 'campaign',
  templateId: 'the-hemodynamic',
  campaignName: '8-week Blood Shunt',
});

describe('the cap', () => {
  it('is the same number of tests a campaign schedules', () => {
    // Two opinions about how many tests can be in flight is one too many.
    expect(MAX_ACTIVE_BENCHMARKS).toBe(MAX_CAMPAIGN_TESTS);
  });

  it('leaves one domain uncovered on purpose', () => {
    // Four domains, three slots: an athlete must choose which adaptation to
    // stop measuring, which is the decision the cap exists to force.
    expect(MAX_ACTIVE_BENCHMARKS).toBeLessThan(4);
  });
});

describe('isBenchmarkableTemplate', () => {
  it('accepts a library template', () => {
    expect(isBenchmarkableTemplate('the-valve')).toBe(true);
  });

  it('refuses a coach workout, whose content can change underneath it', () => {
    expect(isBenchmarkableTemplate('coach:0f8e1c22-1111-2222-3333-444455556666')).toBe(false);
  });

  it('refuses an ad-hoc mission with no template', () => {
    expect(isBenchmarkableTemplate(null)).toBe(false);
    expect(isBenchmarkableTemplate('')).toBe(false);
  });

  it('refuses a template id this build does not know', () => {
    expect(isBenchmarkableTemplate('the-workout-that-never-was')).toBe(false);
  });
});

describe('canDesignateBenchmark', () => {
  it('accepts the first benchmark and reports the domain it claims', () => {
    expect(canDesignateBenchmark({ templateId: 'the-valve', cap: 10, slots: [] })).toEqual({
      ok: true,
      domain: 10,
    });
  });

  it('resolves the domain from the clock, not from a canonical minute', () => {
    // 12 and 15 are both the 15-minute domain, so they compete for one slot.
    expect(
      canDesignateBenchmark({ templateId: 'the-valve', cap: 12, slots: [personal(15)] })
    ).toMatchObject({ ok: false, reason: 'domain-taken-personal' });
  });

  it('refuses a clock that falls between domains', () => {
    for (const cap of [6, 11, 16, 17]) {
      expect(canDesignateBenchmark({ templateId: 'the-valve', cap, slots: [] })).toEqual({
        ok: false,
        reason: 'cap-has-no-domain',
      });
    }
  });

  it('refuses a coach workout before looking at slots at all', () => {
    expect(canDesignateBenchmark({ templateId: 'coach:abc', cap: 10, slots: [] })).toEqual({
      ok: false,
      reason: 'not-a-library-template',
    });
  });

  it('names the campaign that is holding the domain', () => {
    const verdict = canDesignateBenchmark({
      templateId: 'the-valve',
      cap: 10,
      slots: [campaign(10)],
    });
    expect(verdict).toMatchObject({ ok: false, reason: 'domain-taken-campaign' });
    expect(verdict.ok === false && verdict.blocking?.campaignName).toBe('8-week Blood Shunt');
  });

  it('counts a campaign benchmark against the three', () => {
    // Two personal plus one campaign is full, even though only two were chosen.
    const slots = [campaign(20), personal(5), personal(10)];
    expect(activeBenchmarkCount(slots)).toBe(MAX_ACTIVE_BENCHMARKS);
    expect(canDesignateBenchmark({ templateId: 'the-valve', cap: 15, slots })).toEqual({
      ok: false,
      reason: 'at-limit',
    });
  });

  it('reports a taken domain rather than the limit when both apply', () => {
    // "Your 15-minute slot is taken" is actionable; "limit reached" is not.
    const slots = [personal(5), personal(10), personal(15)];
    expect(canDesignateBenchmark({ templateId: 'the-valve', cap: 15, slots })).toMatchObject({
      reason: 'domain-taken-personal',
    });
  });

  it('lets an athlete fill the last free domain', () => {
    const slots = [personal(5), campaign(10)];
    expect(canDesignateBenchmark({ templateId: 'the-valve', cap: 20, slots })).toEqual({
      ok: true,
      domain: 20,
    });
  });
});

describe('benchmarkOccupancy', () => {
  it('keeps the campaign claim visible when both list the same domain', () => {
    // Ordering matters at the call site: campaign slots are listed first so an
    // athlete is never told a domain is free when a campaign is testing in it.
    const occupancy = benchmarkOccupancy([campaign(10), personal(10)]);
    expect(occupancy.get(10)?.source).toBe('campaign');
  });

  it('counts one occupant per domain, not one per slot', () => {
    expect(activeBenchmarkCount([campaign(10), personal(10)])).toBe(1);
  });

  it('is empty for an athlete with nothing designated', () => {
    expect(activeBenchmarkCount([])).toBe(0);
  });
});
