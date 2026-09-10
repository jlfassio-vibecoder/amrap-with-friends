import { describe, expect, it } from 'vitest';
import { TIME_DOMAINS } from '@/data/workoutTemplates';
import {
  brandNameForDomain,
  guidanceForDomain,
  TIME_DOMAIN_GUIDANCE,
  timeDomainGuidanceEntries,
} from '@/data/timeDomainGuidance';

const EXPECTED_BRANDS = {
  5: 'Sprint',
  10: 'Crucible',
  15: 'Grind',
  20: 'Marathon',
} as const;

describe('TIME_DOMAIN_GUIDANCE', () => {
  it('covers every time domain with complete copy and ratings', () => {
    for (const domain of TIME_DOMAINS) {
      const guidance = TIME_DOMAIN_GUIDANCE[domain];
      expect(guidance.brandName).toBe(EXPECTED_BRANDS[domain]);
      expect(guidance.tagline.trim().length).toBeGreaterThan(0);
      expect(guidance.fatBurn.trim().length).toBeGreaterThan(0);
      expect(guidance.muscle.trim().length).toBeGreaterThan(0);
      expect(guidance.cardio.trim().length).toBeGreaterThan(0);
      expect(guidance.feel.trim().length).toBeGreaterThan(0);
      expect(guidance.bestFit.trim().length).toBeGreaterThan(0);

      for (const value of Object.values(guidance.ratings)) {
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(10);
      }
    }
  });

  it('keeps HUD brand names stable through helpers', () => {
    expect(brandNameForDomain(5)).toBe('Sprint');
    expect(guidanceForDomain(10).brandName).toBe('Crucible');
    expect(timeDomainGuidanceEntries().map((entry) => entry.guidance.brandName)).toEqual([
      'Sprint',
      'Crucible',
      'Grind',
      'Marathon',
    ]);
  });
});
