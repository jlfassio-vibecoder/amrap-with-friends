import { describe, it, expect } from 'vitest';
import { evaluateLoadImbalance } from './evaluateLoadImbalance';
import type { HudDomainMinutes } from './types';

function domains(
  five: number,
  ten: number,
  fifteen: number,
  twenty: number,
  other = 0
): HudDomainMinutes {
  return { 5: five, 10: ten, 15: fifteen, 20: twenty, other };
}

describe('evaluateLoadImbalance', () => {
  it('returns false when all domains are empty', () => {
    expect(evaluateLoadImbalance(domains(0, 0, 0, 0))).toEqual({ imbalanced: false });
  });

  it('returns false when only other has volume', () => {
    expect(evaluateLoadImbalance(domains(0, 0, 0, 0, 90))).toEqual({
      imbalanced: false,
    });
  });

  it('returns false for balanced cores', () => {
    expect(evaluateLoadImbalance(domains(40, 40, 40, 40))).toEqual({
      imbalanced: false,
    });
  });

  it('returns false at exactly 60%', () => {
    expect(evaluateLoadImbalance(domains(90, 30, 20, 10))).toEqual({
      imbalanced: false,
    });
  });

  it('returns true just over 60%', () => {
    expect(evaluateLoadImbalance(domains(61, 13, 13, 13))).toEqual({
      imbalanced: true,
      dominant: 5,
      share: 61,
      warning: 'System Warning: Imbalanced Load. 20-Minute Marathon required.',
    });
  });

  it('flags sprint hide with Marathon warning', () => {
    expect(evaluateLoadImbalance(domains(120, 10, 10, 10))).toEqual({
      imbalanced: true,
      dominant: 5,
      share: 80,
      warning: 'System Warning: Imbalanced Load. 20-Minute Marathon required.',
    });
  });

  it('flags marathon hide with Sprint warning', () => {
    expect(evaluateLoadImbalance(domains(10, 10, 10, 120))).toEqual({
      imbalanced: true,
      dominant: 20,
      share: 80,
      warning:
        'System Warning: Imbalanced Load. You never touch the redline. 5-Minute Sprint required.',
    });
  });

  it('flags crucible hide', () => {
    expect(evaluateLoadImbalance(domains(10, 120, 10, 10))).toEqual({
      imbalanced: true,
      dominant: 10,
      share: 80,
      warning:
        'System Warning: Imbalanced Load. Extend the domain. 15-Minute Grind required.',
    });
  });

  it('flags grind hide', () => {
    expect(evaluateLoadImbalance(domains(10, 10, 120, 10))).toEqual({
      imbalanced: true,
      dominant: 15,
      share: 80,
      warning:
        'System Warning: Imbalanced Load. You are hiding in the Grind. Sprint or Marathon required.',
    });
  });

  it('excludes other from the imbalance denominator', () => {
    expect(evaluateLoadImbalance(domains(80, 10, 10, 0, 500))).toEqual({
      imbalanced: true,
      dominant: 5,
      share: 80,
      warning: 'System Warning: Imbalanced Load. 20-Minute Marathon required.',
    });
  });
});
