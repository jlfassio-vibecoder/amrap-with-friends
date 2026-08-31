import { describe, expect, it } from 'vitest';
import {
  effectiveRallyPointCountdownEndsAt,
  elapsedPastRallyPointCountdownSec,
  formatPlusElapsed,
  formatTMinus,
  isPlausibleRallyPointCountdownEndsAt,
  remainingRallyPointCountdownSec,
  RALLY_POINT_COUNTDOWN_MAX_SECONDS,
} from './rallyPointCountdown';

describe('rallyPointCountdown', () => {
  it('rejects far-future ends_at that could not come from set_rally_point_countdown', () => {
    const now = Date.parse('2026-08-25T12:00:00.000Z');
    const scheduledHourOut = '2026-08-25T13:00:00.000Z';
    expect(isPlausibleRallyPointCountdownEndsAt(scheduledHourOut, now)).toBe(false);
    expect(effectiveRallyPointCountdownEndsAt(scheduledHourOut, now)).toBeNull();

    const armedFiveMin = '2026-08-25T12:05:00.000Z';
    expect(isPlausibleRallyPointCountdownEndsAt(armedFiveMin, now)).toBe(true);
    expect(effectiveRallyPointCountdownEndsAt(armedFiveMin, now)).toBe(armedFiveMin);

    const maxArmed = new Date(now + RALLY_POINT_COUNTDOWN_MAX_SECONDS * 1000).toISOString();
    expect(isPlausibleRallyPointCountdownEndsAt(maxArmed, now)).toBe(true);

    const pastEnd = '2026-08-25T11:59:00.000Z';
    expect(isPlausibleRallyPointCountdownEndsAt(pastEnd, now)).toBe(true);
  });

  it('returns null when endsAt is missing or invalid', () => {
    expect(remainingRallyPointCountdownSec(null, Date.now())).toBeNull();
    expect(remainingRallyPointCountdownSec(undefined, Date.now())).toBeNull();
    expect(remainingRallyPointCountdownSec('not-a-date', Date.now())).toBeNull();
  });

  it('clamps remaining seconds at zero and ceilings fractional seconds', () => {
    const now = Date.parse('2026-08-25T12:00:00.000Z');
    expect(remainingRallyPointCountdownSec('2026-08-25T12:00:00.400Z', now)).toBe(1);
    expect(remainingRallyPointCountdownSec('2026-08-25T12:00:05.000Z', now)).toBe(5);
    expect(remainingRallyPointCountdownSec('2026-08-25T11:59:50.000Z', now)).toBe(0);
  });

  it('formats T-MINUS MM:SS', () => {
    expect(formatTMinus(299)).toBe('T-MINUS 04:59');
    expect(formatTMinus(0)).toBe('T-MINUS 00:00');
    expect(formatTMinus(600)).toBe('T-MINUS 10:00');
  });

  it('returns elapsed past ends_at as floor seconds, zero before end', () => {
    const endsAt = '2026-08-25T12:00:00.000Z';
    expect(elapsedPastRallyPointCountdownSec(endsAt, Date.parse('2026-08-25T11:59:50.000Z'))).toBe(
      0
    );
    expect(elapsedPastRallyPointCountdownSec(endsAt, Date.parse('2026-08-25T12:00:00.000Z'))).toBe(
      0
    );
    expect(elapsedPastRallyPointCountdownSec(endsAt, Date.parse('2026-08-25T12:00:05.900Z'))).toBe(
      5
    );
    expect(elapsedPastRallyPointCountdownSec(null, Date.now())).toBeNull();
  });

  it('formats plus elapsed MM:SS', () => {
    expect(formatPlusElapsed(0)).toBe('+00:00');
    expect(formatPlusElapsed(65)).toBe('+01:05');
    expect(formatPlusElapsed(600)).toBe('+10:00');
  });
});
