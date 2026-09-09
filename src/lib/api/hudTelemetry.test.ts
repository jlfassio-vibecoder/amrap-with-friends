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
  activeRecovery: 0,
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
  acuteMinutes7d: 30,
  chronicWeeklyMinutes28d: 30,
  observedDays: 28,
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
      weekPviMissions: [],
      weekEndsAt: '2026-08-25T07:00:00.000Z',
      lastLockedAt: '2026-08-24T10:00:00.000Z',
      attrition: attrition12,
      // Absent from this payload: a server behind the week-history migration
      // parses fine and the HUD degrades to the read-only attrition strip.
      weeks: [],
      domainMinutes30d,
      classification,
      activity7d,
      overtraining,
    });
  });

  it('parses weekPviMissions when present', () => {
    const weekPviMissions = [
      {
        missionId: '11111111-1111-4111-8111-111111111111',
        pvi: 68.2,
        durationMinutes: 5,
        templateId: 'blood-shunt',
        lockedAt: '2026-08-24T18:00:00.000Z',
      },
      {
        missionId: '22222222-2222-4222-8222-222222222222',
        pvi: 12.0,
        durationMinutes: 15,
        templateId: null,
        lockedAt: '2026-08-23T18:00:00.000Z',
      },
    ];
    expect(
      parseHudTelemetryPayload({
        weekMinutes: 75,
        weekPviAverage: 40.1,
        weekPviMissions,
        weekEndsAt: '2026-08-25T07:00:00.000Z',
        lastLockedAt: '2026-08-24T18:00:00.000Z',
        attrition: attrition12,
        domainMinutes30d,
        classification,
        activity7d,
        overtraining,
      })?.weekPviMissions
    ).toEqual(weekPviMissions);
  });

  it('treats a missing weekPviMissions field as an empty list', () => {
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
      })?.weekPviMissions
    ).toEqual([]);
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
        domainMinutes30d: { 5: 0, 10: 0, 15: 0, 20: 0, other: 0, activeRecovery: 0 },
        classification: emptyClassification,
        activity7d: emptyActivity7d,
        overtraining: { acuteLoad7d: 0, chronicWeeklyLoad28d: 0, consecutiveHighIntensityDays: 0 },
      })
    ).toEqual({
      weekMinutes: 0,
      weekPviAverage: null,
      weekPviMissions: [],
      weekEndsAt: '2026-08-25T07:00:00.000Z',
      lastLockedAt: null,
      attrition: Array.from({ length: 12 }, () => false),
      weeks: [],
      domainMinutes30d: { 5: 0, 10: 0, 15: 0, 20: 0, other: 0, activeRecovery: 0 },
      classification: emptyClassification,
      activity7d: emptyActivity7d,
      // No minutes or window in the payload: a client running ahead of the
      // migration degrades to the old load-only numbers and a settled baseline
      // rather than dropping the whole telemetry read.
      overtraining: {
        acuteLoad7d: 0,
        chronicWeeklyLoad28d: 0,
        consecutiveHighIntensityDays: 0,
        acuteMinutes7d: 0,
        chronicWeeklyMinutes28d: 0,
        observedDays: 28,
      },
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
    expect(
      parseHudTelemetryPayload({
        weekMinutes: 10,
        weekPviAverage: null,
        weekEndsAt: '2026-08-25T07:00:00.000Z',
        lastLockedAt: null,
        attrition: Array.from({ length: 12 }, () => false),
        domainMinutes30d: { 5: 1, 10: 1, 15: 1, 20: 1, other: 0 },
        classification,
        activity7d,
        overtraining,
      })
    ).toBeNull();
  });
});

/**
 * The `weeks` array is the client's half of the week-history migration
 * contract. These pin the exact jsonb the SQL builds — object keys, the
 * timestamptz `weekStart`, and the nullable `pviAverage`/`finalScore`/`pvi` — so a
 * drift between the migration and this parser fails here rather than showing
 * an athlete an empty history panel with no error.
 */
describe('parseHudTelemetryPayload — week history', () => {
  const basePayload = {
    weekMinutes: 0,
    weekPviAverage: null,
    weekEndsAt: '2026-08-25T07:00:00.000Z',
    lastLockedAt: null,
    attrition: Array.from({ length: 12 }, () => false),
    domainMinutes30d: { 5: 0, 10: 0, 15: 0, 20: 0, other: 0, activeRecovery: 0 },
    classification: {
      current: 'unclassified',
      previous: 'unclassified',
      progress: {
        weekMinutes: 0,
        intensity3PlusCount: 0,
        intensity4PlusCount: 0,
        marathon20Count: 0,
      },
    },
    activity7d: { missionCount: 0, minutes: 0, avgIntensity: null },
    overtraining: { acuteLoad7d: 0, chronicWeeklyLoad28d: 0, consecutiveHighIntensityDays: 0 },
  };

  const week = {
    weekStart: '2026-09-07T07:00:00.000Z',
    minutes: 60,
    compliant: false,
    missionCount: 2,
    score: 700,
    pviAverage: 6.4,
    missions: [
      {
        missionId: '11111111-1111-4111-8111-111111111111',
        pvi: 5.1,
        durationMinutes: 20,
        templateId: 'the-pendulum',
        lockedAt: '2026-09-08T17:00:00.000Z',
        finalScore: 236,
      },
    ],
  };

  it('parses a week with its missions', () => {
    const parsed = parseHudTelemetryPayload({ ...basePayload, weeks: [week] });
    expect(parsed?.weeks).toHaveLength(1);
    expect(parsed?.weeks[0].score).toBe(700);
    expect(parsed?.weeks[0].compliant).toBe(false);
    expect(parsed?.weeks[0].missions[0].finalScore).toBe(236);
    expect(parsed?.weeks[0].missions[0].templateId).toBe('the-pendulum');
  });

  it('accepts a null pviAverage for a week that scored nothing', () => {
    const empty = {
      ...week,
      missionCount: 0,
      minutes: 0,
      score: 0,
      pviAverage: null,
      missions: [],
    };
    const parsed = parseHudTelemetryPayload({ ...basePayload, weeks: [empty] });
    expect(parsed?.weeks[0].pviAverage).toBeNull();
    expect(parsed?.weeks[0].missions).toEqual([]);
  });

  it('accepts a mission whose final score never locked', () => {
    const noScore = { ...week, missions: [{ ...week.missions[0], finalScore: null }] };
    const parsed = parseHudTelemetryPayload({ ...basePayload, weeks: [noScore] });
    expect(parsed?.weeks[0].missions[0].finalScore).toBeNull();
  });

  it('accepts a mission whose pvi is null without wiping weeks', () => {
    const noPvi = { ...week, missions: [{ ...week.missions[0], pvi: null }] };
    const parsed = parseHudTelemetryPayload({ ...basePayload, weeks: [noPvi] });
    expect(parsed?.weeks).toHaveLength(1);
    expect(parsed?.weeks[0].missions[0].pvi).toBeNull();
    expect(parsed?.weeks[0].missions[0].finalScore).toBe(236);
  });

  it('drops the whole array on a malformed week rather than rendering a half-week', () => {
    const bad = { ...week, minutes: 'sixty' };
    const parsed = parseHudTelemetryPayload({ ...basePayload, weeks: [week, bad] });
    expect(parsed).not.toBeNull();
    expect(parsed?.weeks).toEqual([]);
  });

  it('drops weeks when missions is not an array', () => {
    const bad = { ...week, missions: { not: 'a list' } };
    const parsed = parseHudTelemetryPayload({ ...basePayload, weeks: [bad] });
    expect(parsed).not.toBeNull();
    expect(parsed?.weeks).toEqual([]);
  });

  it('treats a missing weeks key as no history, keeping the rest of the payload', () => {
    const parsed = parseHudTelemetryPayload(basePayload);
    expect(parsed).not.toBeNull();
    expect(parsed?.weeks).toEqual([]);
  });
});
