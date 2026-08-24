import { describe, it, expect } from 'vitest';
import { parseHudTelemetryPayload } from './hudTelemetry';

describe('parseHudTelemetryPayload', () => {
  it('parses a valid weekly payload', () => {
    expect(
      parseHudTelemetryPayload({
        weekMinutes: 75,
        weekPviAverage: 12.8,
        weekEndsAt: '2026-08-25T07:00:00.000Z',
      })
    ).toEqual({
      weekMinutes: 75,
      weekPviAverage: 12.8,
      weekEndsAt: '2026-08-25T07:00:00.000Z',
    });
  });

  it('allows null weekPviAverage', () => {
    expect(
      parseHudTelemetryPayload({
        weekMinutes: 0,
        weekPviAverage: null,
        weekEndsAt: '2026-08-25T07:00:00.000Z',
      })
    ).toEqual({
      weekMinutes: 0,
      weekPviAverage: null,
      weekEndsAt: '2026-08-25T07:00:00.000Z',
    });
  });

  it('rejects invalid shapes', () => {
    expect(parseHudTelemetryPayload(null)).toBeNull();
    expect(
      parseHudTelemetryPayload({
        weekMinutes: -1,
        weekPviAverage: null,
        weekEndsAt: '2026-08-25T07:00:00.000Z',
      })
    ).toBeNull();
    expect(
      parseHudTelemetryPayload({
        weekMinutes: 10,
        weekPviAverage: 'bad',
        weekEndsAt: '2026-08-25T07:00:00.000Z',
      })
    ).toBeNull();
  });
});
