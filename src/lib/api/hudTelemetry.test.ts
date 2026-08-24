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

const domainMinutes30d = {
  5: 20,
  10: 10,
  15: 15,
  20: 40,
  other: 0,
};

describe('parseHudTelemetryPayload', () => {
  it('parses a valid Phase 3 payload', () => {
    expect(
      parseHudTelemetryPayload({
        weekMinutes: 75,
        weekPviAverage: 12.8,
        weekEndsAt: '2026-08-25T07:00:00.000Z',
        lastLockedAt: '2026-08-24T10:00:00.000Z',
        attrition: attrition12,
        domainMinutes30d,
      })
    ).toEqual({
      weekMinutes: 75,
      weekPviAverage: 12.8,
      weekEndsAt: '2026-08-25T07:00:00.000Z',
      lastLockedAt: '2026-08-24T10:00:00.000Z',
      attrition: attrition12,
      domainMinutes30d,
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
        domainMinutes30d: { 5: 0, 10: 0, 15: 0, 20: 0, other: 0 },
      })
    ).toEqual({
      weekMinutes: 0,
      weekPviAverage: null,
      weekEndsAt: '2026-08-25T07:00:00.000Z',
      lastLockedAt: null,
      attrition: Array.from({ length: 12 }, () => false),
      domainMinutes30d: { 5: 0, 10: 0, 15: 0, 20: 0, other: 0 },
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
        domainMinutes30d,
      })
    ).toBeNull();
    expect(
      parseHudTelemetryPayload({
        weekMinutes: 10,
        weekPviAverage: null,
        weekEndsAt: '2026-08-25T07:00:00.000Z',
        lastLockedAt: null,
        attrition: [true, false],
        domainMinutes30d,
      })
    ).toBeNull();
    expect(
      parseHudTelemetryPayload({
        weekMinutes: 10,
        weekPviAverage: null,
        weekEndsAt: '2026-08-25T07:00:00.000Z',
        lastLockedAt: null,
        attrition: Array.from({ length: 12 }, () => false),
        domainMinutes30d: { 5: 1, 10: 1, 15: 1 },
      })
    ).toBeNull();
  });
});
