import { describe, it, expect } from 'vitest';
import { describePviGuidance } from '@/lib/scoring/pviGuidance';
import { getPviMultiplier } from '@/lib/scoring/getPviMultiplier';

describe('describePviGuidance', () => {
  it('uses the band names the rest of the product already shows', () => {
    for (const pvi of [null, 5, 15, 25, 41.4]) {
      expect(describePviGuidance(pvi).classification).toBe(getPviMultiplier(pvi).classification);
    }
  });

  it('explains the number in the reader own value, not in the abstract', () => {
    expect(describePviGuidance(41.4).meaning).toContain('41.4%');
    expect(describePviGuidance(41.4).meaning).toMatch(/slowest and fastest/i);
  });

  it('gives every failing band a cause and a fix', () => {
    // The complaint this exists for: "System Failure" with nothing under it
    // tells an athlete only that the app disapproves.
    for (const pvi of [25, 41.4, 80]) {
      const guidance = describePviGuidance(pvi);
      expect(guidance.cause).toBeTruthy();
      expect(guidance.fix).toBeTruthy();
    }
  });

  it('names the interrupted round as a cause at the widest spread', () => {
    // A missed Log round inflates one split, and the product has a recovery
    // path for it — so it belongs in the explanation rather than leaving the
    // athlete to assume they paced badly.
    const guidance = describePviGuidance(41.4);
    expect(guidance.cause).toMatch(/log round|interrupted/i);
    expect(guidance.fix).toMatch(/first round slower/i);
  });

  it('tells a well-paced athlete to change nothing', () => {
    const guidance = describePviGuidance(5);
    expect(guidance.cause).toBeNull();
    expect(guidance.fix).toMatch(/nothing to change/i);
  });

  it('asks for data rather than guessing when there is none', () => {
    const guidance = describePviGuidance(null);
    expect(guidance.cause).toBeNull();
    expect(guidance.fix).toBeNull();
    expect(guidance.meaning).toMatch(/no pacing data/i);
  });

  it('changes its advice at each band boundary', () => {
    const fixes = [5, 15, 25, 35].map((pvi) => describePviGuidance(pvi).fix);
    expect(new Set(fixes).size).toBe(fixes.length);
  });
});
