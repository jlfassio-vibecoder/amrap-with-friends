import { describe, it, expect } from 'vitest';
import type { PhysicalActivityEntry } from '@/lib/api/physicalActivity';
import { buildActivityAttribution, summarizePhysicalActivityWindow } from './activityWindowSummary';

function entry(
  partial: Partial<PhysicalActivityEntry> & Pick<PhysicalActivityEntry, 'occurredAt'>
): PhysicalActivityEntry {
  return {
    id: partial.id ?? 'id-1',
    activityType: partial.activityType ?? 'run',
    activityCategory: partial.activityCategory ?? 'cardio',
    activityLabel: partial.activityLabel ?? 'Run',
    durationMinutes: partial.durationMinutes ?? 30,
    intensityTier: partial.intensityTier ?? 3,
    occurredAt: partial.occurredAt,
    notes: partial.notes ?? null,
    createdAt: partial.createdAt ?? partial.occurredAt,
  };
}

describe('summarizePhysicalActivityWindow', () => {
  const nowMs = Date.parse('2026-08-31T12:00:00.000Z');

  it('sums missions, minutes, and average intensity within 7 days', () => {
    const summary = summarizePhysicalActivityWindow(
      [
        entry({ occurredAt: '2026-08-30T10:00:00.000Z', durationMinutes: 20, intensityTier: 2 }),
        entry({ occurredAt: '2026-08-28T10:00:00.000Z', durationMinutes: 40, intensityTier: 4 }),
        entry({ occurredAt: '2026-08-20T10:00:00.000Z', durationMinutes: 99, intensityTier: 5 }),
      ],
      nowMs
    );

    expect(summary).toEqual({
      missionCount: 2,
      totalMinutes: 60,
      averageIntensity: 3,
    });
  });

  it('returns null average intensity when empty', () => {
    expect(summarizePhysicalActivityWindow([], nowMs)).toEqual({
      missionCount: 0,
      totalMinutes: 0,
      averageIntensity: null,
    });
  });
});

describe('buildActivityAttribution', () => {
  it('splits percent by minutes', () => {
    expect(
      buildActivityAttribution({
        inAppMissions: 2,
        outsideMissions: 1,
        inAppMinutes: 40,
        outsideMinutes: 60,
      })
    ).toEqual({
      totalMissions: 3,
      totalMinutes: 100,
      inAppMinutes: 40,
      outsideMinutes: 60,
      inAppPercent: 40,
      outsidePercent: 60,
    });
  });

  it('returns zero percents when total minutes is 0', () => {
    expect(
      buildActivityAttribution({
        inAppMissions: 0,
        outsideMissions: 0,
        inAppMinutes: 0,
        outsideMinutes: 0,
      })
    ).toEqual({
      totalMissions: 0,
      totalMinutes: 0,
      inAppMinutes: 0,
      outsideMinutes: 0,
      inAppPercent: 0,
      outsidePercent: 0,
    });
  });

  it('attributes 100% to in-app when outside is empty', () => {
    expect(
      buildActivityAttribution({
        inAppMissions: 3,
        outsideMissions: 0,
        inAppMinutes: 45,
        outsideMinutes: 0,
      })
    ).toMatchObject({
      totalMinutes: 45,
      inAppPercent: 100,
      outsidePercent: 0,
    });
  });
});
