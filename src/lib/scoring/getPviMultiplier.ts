import type { PviMultiplierResult } from '@/lib/scoring/types';

export function getPviMultiplier(pviPercent: number | null): PviMultiplierResult {
  if (pviPercent === null) {
    return {
      multiplier: 1.0,
      classification: 'Insufficient Data',
      verdict: 'Insufficient Data. Survive longer next time.',
    };
  }

  if (pviPercent < 10) {
    return {
      multiplier: 1.15,
      classification: 'Elite Pacing',
      verdict: 'Surgical precision. You controlled the panic.',
    };
  }

  if (pviPercent < 20) {
    return {
      multiplier: 1.0,
      classification: 'Standard',
      verdict: 'Acceptable degradation. You survived.',
    };
  }

  if (pviPercent < 30) {
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
