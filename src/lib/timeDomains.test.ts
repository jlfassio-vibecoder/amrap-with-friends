import { describe, it, expect } from 'vitest';
import { TIME_DOMAINS } from '@/data/workoutTemplates';
import {
  allTimeCaps,
  capsForDomain,
  defaultCapForDomain,
  domainForCap,
  isCapInDomain,
  isLegalCap,
  MAX_TIME_CAP,
  MIN_TIME_CAP,
} from '@/lib/timeDomains';

describe('timeDomains', () => {
  it('offers the agreed range for each domain', () => {
    expect(capsForDomain(5)).toEqual([3, 4, 5]);
    expect(capsForDomain(10)).toEqual([7, 8, 9, 10]);
    expect(capsForDomain(15)).toEqual([12, 13, 14, 15]);
    expect(capsForDomain(20)).toEqual([18, 19, 20, 21, 22, 23, 24, 25]);
  });

  it('hard-caps Long at 25', () => {
    expect(MAX_TIME_CAP).toBe(25);
    expect(isLegalCap(25)).toBe(true);
    expect(isLegalCap(26)).toBe(false);
    expect(MIN_TIME_CAP).toBe(3);
    expect(isLegalCap(2)).toBe(false);
  });

  it('defaults every domain to its canonical minute', () => {
    for (const domain of TIME_DOMAINS) {
      expect(defaultCapForDomain(domain)).toBe(domain);
      expect(isCapInDomain(defaultCapForDomain(domain), domain)).toBe(true);
    }
  });

  it('maps every legal cap back to exactly one domain', () => {
    for (const domain of TIME_DOMAINS) {
      for (const cap of capsForDomain(domain)) {
        expect(domainForCap(cap)).toBe(domain);
      }
    }
  });

  it('leaves the gaps unclaimed rather than snapping them to a neighbour', () => {
    for (const gap of [6, 11, 16, 17]) {
      expect(domainForCap(gap)).toBeNull();
    }
  });

  it('does not claim a coach WOD that sits outside every range', () => {
    expect(domainForCap(30)).toBeNull();
    expect(domainForCap(1)).toBeNull();
  });

  it('rejects a fractional cap', () => {
    expect(isCapInDomain(7.5, 10)).toBe(false);
    expect(domainForCap(7.5)).toBeNull();
  });

  it('lists every legal cap once, ascending', () => {
    const caps = allTimeCaps();
    expect(caps).toEqual([...caps].sort((a, b) => a - b));
    expect(new Set(caps).size).toBe(caps.length);
    expect(caps).toHaveLength(3 + 4 + 4 + 8);
  });
});
