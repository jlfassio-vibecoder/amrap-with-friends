import { describe, it, expect } from 'vitest';
import {
  computeTimeSinceLastBurn,
  DETRAINING_AFTER_HOURS,
  DORMANT_AFTER_HOURS,
} from './computeTimeSinceLastBurn';

const NOW = Date.parse('2026-08-24T12:00:00.000Z');
const ago = (minutes: number) => new Date(NOW - minutes * 60 * 1000).toISOString();

describe('computeTimeSinceLastBurn', () => {
  it('says there is no record rather than showing a clock', () => {
    expect(computeTimeSinceLastBurn(null, NOW)).toMatchObject({
      status: 'never',
      label: '—',
      hoursElapsed: null,
    });
    expect(computeTimeSinceLastBurn('not-a-date', NOW).status).toBe('never');
  });

  it('counts up from the last lock, and never says T-minus', () => {
    // The clock measures elapsed time. Labelling it "T-MINUS" named a countdown
    // to something, so a reader waited for it to fall and concluded it was
    // frozen — which is how the number went a fortnight without being read.
    const result = computeTimeSinceLastBurn(ago(23 * 60 + 59), NOW);
    expect(result.label).toBe('23:59');
    expect(result.label).not.toMatch(/t-?minus/i);
    expect(result.caption).toBe('since your last locked mission');
  });

  it('grows as time passes rather than shrinking', () => {
    const earlier = computeTimeSinceLastBurn(ago(60), NOW).label;
    const later = computeTimeSinceLastBurn(ago(120), NOW).label;
    expect(earlier).toBe('01:00');
    expect(later).toBe('02:00');
  });

  it('is active under a day', () => {
    expect(computeTimeSinceLastBurn(ago(23 * 60 + 59), NOW).status).toBe('active');
  });

  it('turns dormant on the hour it says it will', () => {
    expect(computeTimeSinceLastBurn(ago(DORMANT_AFTER_HOURS * 60 - 1), NOW).status).toBe('active');
    expect(computeTimeSinceLastBurn(ago(DORMANT_AFTER_HOURS * 60), NOW).status).toBe('dormant');
  });

  it('turns detraining on the hour it says it will', () => {
    expect(computeTimeSinceLastBurn(ago(DETRAINING_AFTER_HOURS * 60 - 1), NOW).status).toBe(
      'dormant'
    );
    expect(computeTimeSinceLastBurn(ago(DETRAINING_AFTER_HOURS * 60), NOW).status).toBe(
      'detraining'
    );
  });

  it('reports the hours behind the status, so copy can quote them', () => {
    expect(computeTimeSinceLastBurn(ago(55 * 60 + 41), NOW).hoursElapsed).toBeCloseTo(55.68, 1);
  });

  it('pads past 99 hours rather than truncating', () => {
    expect(computeTimeSinceLastBurn(ago(100 * 60 + 5), NOW).label).toBe('100:05');
  });
});
