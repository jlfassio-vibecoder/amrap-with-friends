import { describe, expect, it } from 'vitest';
import {
  buildCheckInProgression,
  checkInVersionNote,
  formatCheckInRpeDelta,
  formatCheckInRpeSeries,
  type CheckInProgressionInput,
} from '@/lib/mission/checkInProgression';

function entry(
  overrides: Partial<CheckInProgressionInput> & { missionId: string; rpe: number | null }
): CheckInProgressionInput {
  return {
    templateId: 'hull-breach',
    durationMinutes: 10,
    createdAt: '2026-01-01T10:00:00.000Z',
    scheduledAt: null,
    ...overrides,
  };
}

describe('buildCheckInProgression', () => {
  it('shows an RPE series for the same workout and clock', () => {
    const groups = buildCheckInProgression([
      entry({ missionId: 'm1', createdAt: '2026-01-01T10:00:00Z', rpe: 6 }),
      entry({ missionId: 'm2', createdAt: '2026-01-08T10:00:00Z', rpe: 7 }),
      entry({ missionId: 'm3', createdAt: '2026-01-15T10:00:00Z', rpe: 8 }),
    ]);

    expect(groups).toHaveLength(1);
    expect(formatCheckInRpeSeries(groups[0])).toBe('RPE 6 → 7 → 8');
    expect(formatCheckInRpeDelta(groups[0])).toBe('+2');
  });

  it('hides a single RPE with nothing to compare', () => {
    expect(buildCheckInProgression([entry({ missionId: 'm1', rpe: 7 })])).toEqual([]);
  });

  it('does not pool different templates or time caps', () => {
    expect(
      buildCheckInProgression([
        entry({ missionId: 'm1', templateId: 'a', rpe: 6 }),
        entry({ missionId: 'm2', templateId: 'b', rpe: 7 }),
        entry({ missionId: 'm3', templateId: 'a', durationMinutes: 15, rpe: 8 }),
      ])
    ).toEqual([]);
  });

  it('skips missions with no RPE', () => {
    expect(
      buildCheckInProgression([
        entry({ missionId: 'm1', rpe: 6 }),
        entry({ missionId: 'm2', rpe: null }),
        entry({ missionId: 'm3', createdAt: '2026-01-15T10:00:00Z', rpe: 8 }),
      ])
    ).toHaveLength(1);
  });
});

describe('an RPE trend that spans two versions of the workout', () => {
  const KNEES = {
    modifiedMovements: ['Diamond Push-ups'],
    movementVariants: { 'Diamond Push-ups': 'push-up--knees' },
  };

  function entry(overrides: Partial<CheckInProgressionInput> & { missionId: string }) {
    return {
      templateId: 'the-valve',
      durationMinutes: 10,
      createdAt: '2026-01-01T10:00:00.000Z',
      scheduledAt: null,
      rpe: 6,
      ...overrides,
    } as CheckInProgressionInput;
  }

  it('keeps the series whole rather than splitting it', () => {
    // Splitting would destroy the trend for exactly the athletes who progress
    // out of a modification, which is the outcome the feature exists to produce.
    const groups = buildCheckInProgression([
      entry({ missionId: 'm1', createdAt: '2026-01-01T10:00:00Z', rpe: 6, ...KNEES }),
      entry({ missionId: 'm2', createdAt: '2026-02-01T10:00:00Z', rpe: 8 }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].points.map((point) => point.rpe)).toEqual([6, 8]);
  });

  it('says the comparison is not like-for-like', () => {
    const groups = buildCheckInProgression([
      entry({ missionId: 'm1', createdAt: '2026-01-01T10:00:00Z', rpe: 6, ...KNEES }),
      entry({ missionId: 'm2', createdAt: '2026-02-01T10:00:00Z', rpe: 8 }),
    ]);

    expect(groups[0].spansVersions).toBe(true);
    expect(checkInVersionNote(groups[0])).toMatch(/not a like-for-like comparison/);
  });

  it('stays quiet when every mission was performed the same way', () => {
    const groups = buildCheckInProgression([
      entry({ missionId: 'm1', createdAt: '2026-01-01T10:00:00Z', rpe: 8, ...KNEES }),
      entry({ missionId: 'm2', createdAt: '2026-02-01T10:00:00Z', rpe: 6, ...KNEES }),
    ]);

    expect(groups[0].spansVersions).toBe(false);
    expect(checkInVersionNote(groups[0])).toBeNull();
  });

  it('stays quiet for two standard missions', () => {
    const groups = buildCheckInProgression([
      entry({ missionId: 'm1', createdAt: '2026-01-01T10:00:00Z', rpe: 8 }),
      entry({ missionId: 'm2', createdAt: '2026-02-01T10:00:00Z', rpe: 6 }),
    ]);

    expect(checkInVersionNote(groups[0])).toBeNull();
  });

  it('notices two different modifications, not just modified vs standard', () => {
    const groups = buildCheckInProgression([
      entry({ missionId: 'm1', createdAt: '2026-01-01T10:00:00Z', rpe: 7, ...KNEES }),
      entry({
        missionId: 'm2',
        createdAt: '2026-02-01T10:00:00Z',
        rpe: 7,
        modifiedMovements: ['Diamond Push-ups'],
        movementVariants: { 'Diamond Push-ups': 'push-up--incline' },
      }),
    ]);

    expect(groups[0].spansVersions).toBe(true);
  });
});
