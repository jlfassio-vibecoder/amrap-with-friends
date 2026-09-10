import type { PviMultiplierResult } from '@/lib/scoring/types';

/**
 * The band boundaries, exported so anything describing the ladder — the
 * scorecard's info modals, in particular — reads them from here rather than
 * copying "10 / 20 / 30" into prose that could drift from what this function
 * actually does.
 */
export const PVI_ELITE_CEILING = 10;
export const PVI_STANDARD_CEILING = 20;
export const PVI_POWER_LEAK_CEILING = 30;

export function getPviMultiplier(pviPercent: number | null): PviMultiplierResult {
  if (pviPercent === null) {
    return {
      multiplier: 1.0,
      classification: 'Insufficient Data',
      verdict: 'Insufficient Data. Survive longer next time.',
    };
  }

  if (pviPercent < PVI_ELITE_CEILING) {
    return {
      multiplier: 1.15,
      classification: 'Elite Pacing',
      verdict: 'Surgical precision. You controlled the panic.',
    };
  }

  if (pviPercent < PVI_STANDARD_CEILING) {
    return {
      multiplier: 1.0,
      classification: 'Standard',
      verdict: 'Acceptable degradation. You survived.',
    };
  }

  if (pviPercent < PVI_POWER_LEAK_CEILING) {
    return {
      multiplier: 0.95,
      classification: 'Power Leak',
      verdict: 'You sprinted early and paid the tax. Check your ego.',
    };
  }

  return {
    multiplier: 0.85,
    classification: 'System Failure',
    verdict: 'A complete tactical collapse. Unacceptable.',
  };
}
