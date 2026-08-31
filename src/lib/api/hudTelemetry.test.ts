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

const classification = {
  current: 'civilian' as const,
  previous: 'unclassified' as const,
  progress: {
    weekMinutes: 75,
    intensity3PlusCount: 0,
    intensity4PlusCount: 0,
    marathon20Count: 0,
  },
};

const overtraining = {
  acuteLoad7d: 60,
  chronicWeeklyLoad28d: 60,
  consecutiveHighIntensityDays: 0,
};

const activity7d = {
  missionCount: 2,
  minutes: 40,
  avgIntensity: 2.5,
};

describe('parseHudTelemetryPayload', () => {
  it('parses a valid Phase 4 payload with classification', () => {
    expect(
      parseHudTelemetryPayload({
        weekMinutes: 75,
        weekPviAverage: 12.8,
        weekEndsAt: '2026-08-25T07:00:00.000Z',
        lastLockedAt: '2026-08-24T10:00:00.000Z',
        attrition: attrition12,
        domainMinutes30d,
        classification,
        activity7d,
        overtraining,
      })
    ).toEqual({
      weekMinutes: 75,
      weekPviAverage: 12.8,
      weekEndsAt: '2026-08-25T07:00:00.000Z',
      lastLockedAt: '2026-08-24T10:00:00.000Z',
      attrition: attrition12,
      domainMinutes30d,
      classification,
      activity7d,
      overtraining,
    });
  });

  it('allows null weekPviAverage and lastLockedAt', () => {
    const emptyClassification = {
      current: 'unclassified' as const,
      previous: 'unclassified' as const,
      progress: {
        weekMinutes: 0,
        intensity3PlusCount: 0,
        intensity4PlusCount: 0,
        marathon20Count: 0,
      },
    };
    const emptyActivity7d = { missionCount: 0, minutes: 0, avgIntensity: null };
    expect(
      parseHudTelemetryPayload({
        weekMinutes: 0,
        weekPviAverage: null,
        weekEndsAt: '2026-08-25T07:00:00.000Z',
        lastLockedAt: null,
        attrition: Array.from({ length: 12 }, () => false),
        domainMinutes30d: { 5: 0, 10: 0, 15: 0, 20: 0, other: 0 },
        classification: emptyClassification,
        activity7d: emptyActivity7d,
        overtraining: { acuteLoad7d: 0, chronicWeeklyLoad28d: 0, consecutiveHighIntensityDays: 0 },
      })
    ).toEqual({
      weekMinutes: 0,
      weekPviAverage: null,
      weekEndsAt: '2026-08-25T07:00:00.000Z',
      lastLockedAt: null,
      attrition: Array.from({ length: 12 }, () => false),
      domainMinutes30d: { 5: 0, 10: 0, 15: 0, 20: 0, other: 0 },
      classification: emptyClassification,
      activity7d: emptyActivity7d,
      overtraining: { acuteLoad7d: 0, chronicWeeklyLoad28d: 0, consecutiveHighIntensityDays: 0 },
    });
  });

  it('rejects missing or invalid classification', () => {
    expect(
      parseHudTelemetryPayload({
        weekMinutes: 10,
        weekPviAverage: null,
        weekEndsAt: '2026-08-25T07:00:00.000Z',
        lastLockedAt: null,
        attrition: Array.from({ length: 12 }, () => false),
        domainMinutes30d,
        activity7d,
        overtraining,
      })
    ).toBeNull();
    expect(
      parseHudTelemetryPayload({
        weekMinutes: 10,
        weekPviAverage: null,
        weekEndsAt: '2026-08-25T07:00:00.000Z',
        lastLockedAt: null,
        attrition: Array.from({ length: 12 }, () => false),
        domainMinutes30d,
        classification: {
          current: 'hero',
          previous: 'unclassified',
          progress: {
            weekMinutes: 10,
            intensity3PlusCount: 0,
            intensity4PlusCount: 0,
            marathon20Count: 0,
          },
        },
        activity7d,
        overtraining,
      })
    ).toBeNull();
  });

  it('rejects missing or invalid activity7d', () => {
    expect(
      parseHudTelemetryPayload({
        weekMinutes: 10,
        weekPviAverage: null,
        weekEndsAt: '2026-08-25T07:00:00.000Z',
        lastLockedAt: null,
        attrition: Array.from({ length: 12 }, () => false),
        domainMinutes30d,
        classification,
        overtraining,
      })
    ).toBeNull();
    expect(
      parseHudTelemetryPayload({
        weekMinutes: 10,
        weekPviAverage: null,
        weekEndsAt: '2026-08-25T07:00:00.000Z',
        lastLockedAt: null,
        attrition: Array.from({ length: 12 }, () => false),
        domainMinutes30d,
        classification,
        activity7d: { missionCount: 0, minutes: 0, avgIntensity: 2 },
        overtraining,
      })
    ).toBeNull();
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
        classification,
        activity7d,
        overtraining,
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
        classification,
        activity7d,
        overtraining,
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
        classification,
        activity7d,
        overtraining,
      })
    ).toBeNull();
  });
});
