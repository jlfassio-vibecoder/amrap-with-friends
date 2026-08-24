import { describe, it, expect } from 'vitest';
import { parseHudTelemetryPayload } from './hudTelemetry';

const attrition12 = [
  false,
  false,
  false,
  true,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  true,
];

describe('parseHudTelemetryPayload', () => {
  it('parses a valid Phase 2 payload', () => {
    expect(
      parseHudTelemetryPayload({
        weekMinutes: 75,
        weekPviAverage: 12.8,
        weekEndsAt: '2026-08-25T07:00:00.000Z',
        lastLockedAt: '2026-08-24T10:00:00.000Z',
        attrition: attrition12,
      })
    ).toEqual({
      weekMinutes: 75,
      weekPviAverage: 12.8,
      weekEndsAt: '2026-08-25T07:00:00.000Z',
      lastLockedAt: '2026-08-24T10:00:00.000Z',
      attrition: attrition12,
    });
  });

  it('allows null weekPviAverage and lastLockedAt', () => {
    expect(
      parseHudTelemetryPayload({
        weekMinutes: 0,
        weekPviAverage: null,
        weekEndsAt: '2026-08-25T07:00:00.000Z',
        lastLockedAt: null,
        attrition: Array.from({ length: 12 }, () => false),
      })
    ).toEqual({
      weekMinutes: 0,
      weekPviAverage: null,
      weekEndsAt: '2026-08-25T07:00:00.000Z',
      lastLockedAt: null,
      attrition: Array.from({ length: 12 }, () => false),
    });
  });

  it('rejects invalid shapes', () => {
    expect(parseHudTelemetryPayload(null)).toBeNull();
    expect(
      parseHudTelemetryPayload({
        weekMinutes: -1,
        weekPviAverage: null,
        weekEndsAt: '2026-08-25T07:00:00.000Z',
        lastLockedAt: null,
        attrition: Array.from({ length: 12 }, () => false),
      })
    ).toBeNull();
    expect(
      parseHudTelemetryPayload({
        weekMinutes: 10,
        weekPviAverage: 'bad',
        weekEndsAt: '2026-08-25T07:00:00.000Z',
        lastLockedAt: null,
        attrition: Array.from({ length: 12 }, () => false),
      })
    ).toBeNull();
    expect(
      parseHudTelemetryPayload({
        weekMinutes: 10,
        weekPviAverage: null,
        weekEndsAt: '2026-08-25T07:00:00.000Z',
        lastLockedAt: null,
        attrition: [true, false],
      })
    ).toBeNull();
  });
});
