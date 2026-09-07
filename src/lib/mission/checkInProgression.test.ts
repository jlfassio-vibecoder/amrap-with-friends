import { describe, expect, it } from 'vitest';
import {
  buildCheckInProgression,
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
