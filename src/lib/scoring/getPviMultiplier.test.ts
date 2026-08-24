import { describe, it, expect } from 'vitest';
import { getPviMultiplier } from './getPviMultiplier';

describe('getPviMultiplier', () => {
  it('returns insufficient data tier for null P.V.I.', () => {
    expect(getPviMultiplier(null)).toEqual({
      multiplier: 1.0,
      classification: 'Insufficient Data',
      verdict: 'Insufficient Data. Survive longer next time.',
    });
  });

  it('maps 9.9% to Elite Pacing', () => {
    expect(getPviMultiplier(9.9)).toEqual({
      multiplier: 1.15,
      classification: 'Elite Pacing',
      verdict: 'Surgical precision. You controlled the panic.',
    });
  });

  it('maps 10.0% to Standard', () => {
    expect(getPviMultiplier(10.0)).toEqual({
      multiplier: 1.0,
      classification: 'Standard',
      verdict: 'Acceptable degradation. You survived.',
    });
  });

  it('maps 19.9% to Standard', () => {
    expect(getPviMultiplier(19.9).classification).toBe('Standard');
  });

  it('maps 20.0% to Power Leak', () => {
    expect(getPviMultiplier(20.0)).toEqual({
      multiplier: 0.95,
      classification: 'Power Leak',
      verdict: 'You sprinted early and paid the tax. Check your ego.',
    });
  });

  it('maps 30.0% to System Failure', () => {
    expect(getPviMultiplier(30.0)).toEqual({
      multiplier: 0.85,
      classification: 'System Failure',
      verdict: 'A complete tactical collapse. Unacceptable.',
    });
  });
});
