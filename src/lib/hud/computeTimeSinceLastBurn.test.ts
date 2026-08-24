import { describe, it, expect } from 'vitest';
import { computeTimeSinceLastBurn } from './computeTimeSinceLastBurn';

const NOW = Date.parse('2026-08-24T12:00:00.000Z');

describe('computeTimeSinceLastBurn', () => {
  it('returns never when lastLockedAt is null', () => {
    expect(computeTimeSinceLastBurn(null, NOW)).toEqual({
      status: 'never',
      label: 'NO LOCK ON RECORD',
    });
  });

  it('returns active under 24 hours', () => {
    const lockedAt = new Date(NOW - (23 * 60 + 59) * 60 * 1000).toISOString();
    expect(computeTimeSinceLastBurn(lockedAt, NOW)).toEqual({
      status: 'active',
      label: 'T-MINUS 23:59',
    });
  });

  it('returns dormant at exactly 24 hours', () => {
    const lockedAt = new Date(NOW - 24 * 60 * 60 * 1000).toISOString();
    expect(computeTimeSinceLastBurn(lockedAt, NOW)).toEqual({
      status: 'dormant',
      label: 'T-MINUS 24:00',
    });
  });

  it('returns dormant under 48 hours', () => {
    const lockedAt = new Date(NOW - (47 * 60 + 59) * 60 * 1000).toISOString();
    expect(computeTimeSinceLastBurn(lockedAt, NOW)).toEqual({
      status: 'dormant',
      label: 'T-MINUS 47:59',
    });
  });

  it('returns detraining at exactly 48 hours', () => {
    const lockedAt = new Date(NOW - 48 * 60 * 60 * 1000).toISOString();
    expect(computeTimeSinceLastBurn(lockedAt, NOW)).toEqual({
      status: 'detraining',
      label: 'T-MINUS 48:00',
    });
  });
});
