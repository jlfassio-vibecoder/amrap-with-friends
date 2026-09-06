import { describe, it, expect } from 'vitest';
import { countsBuyInRound, describeWeeklyPviGuidance } from '@/lib/scoring/pviGuidance';

const BANDS = [null, 5, 15, 25, 41.4, 80];

describe('describeWeeklyPviGuidance', () => {
  it('says the spread is measured inside each mission, not across them', () => {
    // The complaint this exists for: copy that read as though a two-minute round
    // in a 20-minute AMRAP was being compared against a forty-five-second round
    // in a five-minute one. It never was, and the wording must not imply it.
    for (const pvi of BANDS.filter((value) => value !== null)) {
      const meaning = describeWeeklyPviGuidance(pvi).meaning;
      expect(meaning).toMatch(/own rounds/i);
      expect(meaning).toMatch(/that mission/i);
    }
  });

  it('never applies the single-mission band names to a weekly average', () => {
    // Those bands grade one mission and set its multiplier. A mean of several
    // has no multiplier, and labelling it announces a failure that may belong to
    // one workout out of six.
    for (const pvi of BANDS) {
      const guidance = describeWeeklyPviGuidance(pvi);
      const text = `${guidance.meaning} ${guidance.cause ?? ''} ${guidance.fix ?? ''}`;
      expect(text).not.toMatch(/elite pacing|power leak|system failure/i);
    }
  });

  it('warns that an average hides its own shape once it is worth explaining', () => {
    for (const pvi of [25, 41.4, 80]) {
      expect(describeWeeklyPviGuidance(pvi).cause).toMatch(/average/i);
      expect(describeWeeklyPviGuidance(pvi).fix).toMatch(/splits/i);
    }
  });

  it('names the structural reason short missions read higher', () => {
    for (const pvi of [25, 41.4]) {
      expect(describeWeeklyPviGuidance(pvi).cause).toMatch(/every round counts/i);
    }
  });

  it('still names an interrupted round as a cause at the widest spread', () => {
    expect(describeWeeklyPviGuidance(41.4).cause).toMatch(/log round|interrupted/i);
  });

  it('tells a well-paced athlete to change nothing', () => {
    const guidance = describeWeeklyPviGuidance(5);
    expect(guidance.cause).toBeNull();
    expect(guidance.fix).toMatch(/nothing to change/i);
  });

  it('asks for data rather than guessing when there is none', () => {
    const guidance = describeWeeklyPviGuidance(null);
    expect(guidance.cause).toBeNull();
    expect(guidance.fix).toBeNull();
  });

  it('changes its advice at each band boundary', () => {
    const fixes = [5, 15, 25, 35].map((pvi) => describeWeeklyPviGuidance(pvi).fix);
    expect(new Set(fixes).size).toBe(fixes.length);
  });
});

describe('countsBuyInRound', () => {
  it('keeps the opening round only on the shortest missions', () => {
    // This is the asymmetry the copy has to disclose: a 5-minute mission's
    // spread includes its fast opener, a 10-minute one's does not.
    expect(countsBuyInRound(3)).toBe(true);
    expect(countsBuyInRound(5)).toBe(true);
    expect(countsBuyInRound(7)).toBe(false);
    expect(countsBuyInRound(20)).toBe(false);
  });
});
