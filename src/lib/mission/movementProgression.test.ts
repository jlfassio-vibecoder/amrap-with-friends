import { describe, expect, it } from 'vitest';
import {
  AS_PROGRAMMED_LABEL,
  buildMovementProgression,
  formatProgressionDelta,
  formatProgressionScores,
  versionKeyFor,
  type ProgressionInput,
} from '@/lib/mission/movementProgression';

function entry(overrides: Partial<ProgressionInput> & { missionId: string }): ProgressionInput {
  return {
    templateId: 'hull-breach',
    durationMinutes: 10,
    createdAt: '2026-01-01T10:00:00.000Z',
    scheduledAt: null,
    finalScore: 100,
    modifiedMovements: [],
    movementVariants: {},
    ...overrides,
  };
}

const KNEES = {
  modifiedMovements: ['Diamond Push-ups'],
  movementVariants: { 'Diamond Push-ups': 'push-up--knees' },
};

describe('versionKeyFor', () => {
  it('is empty for a mission performed as programmed', () => {
    expect(versionKeyFor({ modifiedMovements: [], movementVariants: {} })).toBe('');
  });

  it('does not depend on the order the movements were marked', () => {
    const a = versionKeyFor({ modifiedMovements: ['B', 'A'], movementVariants: {} });
    const b = versionKeyFor({ modifiedMovements: ['A', 'B'], movementVariants: {} });
    expect(a).toBe(b);
  });

  it('separates a named scaling from an unnamed mark on the same movement', () => {
    const named = versionKeyFor(KNEES);
    const bare = versionKeyFor({
      modifiedMovements: ['Diamond Push-ups'],
      movementVariants: {},
    });
    expect(named).not.toBe(bare);
  });

  it('separates scaling one movement from scaling another', () => {
    expect(versionKeyFor(KNEES)).not.toBe(
      versionKeyFor({
        modifiedMovements: ['Air Squats'],
        movementVariants: { 'Air Squats': 'squat--box' },
      })
    );
  });
});

describe('buildMovementProgression', () => {
  it('tells the story the feature exists for', () => {
    const groups = buildMovementProgression([
      entry({ missionId: 'm1', createdAt: '2026-01-01T10:00:00Z', finalScore: 40, ...KNEES }),
      entry({ missionId: 'm2', createdAt: '2026-01-08T10:00:00Z', finalScore: 45, ...KNEES }),
      entry({ missionId: 'm3', createdAt: '2026-01-15T10:00:00Z', finalScore: 48, ...KNEES }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].series).toHaveLength(1);
    expect(formatProgressionScores(groups[0].series[0])).toBe('40 → 45 → 48 reps');
    expect(formatProgressionDelta(groups[0].series[0])).toBe('+8 reps');
    expect(groups[0].series[0].label).toBe('Diamond Push-ups: from the knees');
  });

  it('keeps a scaled run and a standard run of the same workout as separate series', () => {
    const groups = buildMovementProgression([
      entry({ missionId: 'm1', createdAt: '2026-01-01T10:00:00Z', finalScore: 48, ...KNEES }),
      entry({ missionId: 'm2', createdAt: '2026-02-01T10:00:00Z', finalScore: 36 }),
    ]);

    expect(groups[0].series.map((series) => series.label)).toEqual([
      AS_PROGRAMMED_LABEL,
      'Diamond Push-ups: from the knees',
    ]);
    // The scaled 48 is never blended with the standard 36 into one trend.
    expect(groups[0].series.every((series) => series.points.length === 1)).toBe(true);
  });

  it('does not pool two different scalings of the same workout', () => {
    const groups = buildMovementProgression([
      entry({ missionId: 'm1', createdAt: '2026-01-01T10:00:00Z', finalScore: 40, ...KNEES }),
      entry({
        missionId: 'm2',
        createdAt: '2026-01-08T10:00:00Z',
        finalScore: 44,
        modifiedMovements: ['Diamond Push-ups'],
        movementVariants: { 'Diamond Push-ups': 'push-up--incline' },
      }),
    ]);

    expect(groups[0].series).toHaveLength(2);
  });

  it('does not pool the same scaling across different time caps', () => {
    const groups = buildMovementProgression([
      entry({ missionId: 'm1', durationMinutes: 10, finalScore: 40, ...KNEES }),
      entry({ missionId: 'm2', durationMinutes: 20, finalScore: 90, ...KNEES }),
    ]);

    expect(groups).toEqual([]);
  });

  it('does not pool the same scaling across different workouts', () => {
    const groups = buildMovementProgression([
      entry({ missionId: 'm1', templateId: 'hull-breach', finalScore: 40, ...KNEES }),
      entry({ missionId: 'm2', templateId: 'blood-shunt', finalScore: 44, ...KNEES }),
    ]);

    expect(groups).toEqual([]);
  });

  it('skips a workout that was never scaled — that is the ghost’s job', () => {
    expect(
      buildMovementProgression([
        entry({ missionId: 'm1', createdAt: '2026-01-01T10:00:00Z', finalScore: 40 }),
        entry({ missionId: 'm2', createdAt: '2026-01-08T10:00:00Z', finalScore: 44 }),
      ])
    ).toEqual([]);
  });

  it('skips a single scaled mission with nothing to compare it to', () => {
    expect(buildMovementProgression([entry({ missionId: 'm1', ...KNEES })])).toEqual([]);
  });

  it('ignores unscored and template-less missions', () => {
    expect(
      buildMovementProgression([
        entry({ missionId: 'm1', finalScore: null, ...KNEES }),
        entry({ missionId: 'm2', finalScore: 40, ...KNEES }),
        entry({ missionId: 'm3', templateId: null, finalScore: 44, ...KNEES }),
      ])
    ).toEqual([]);
  });

  it('orders points oldest first and groups most recent first', () => {
    const groups = buildMovementProgression([
      entry({ missionId: 'old2', createdAt: '2026-01-08T10:00:00Z', finalScore: 45, ...KNEES }),
      entry({ missionId: 'old1', createdAt: '2026-01-01T10:00:00Z', finalScore: 40, ...KNEES }),
      entry({
        missionId: 'new1',
        templateId: 'blood-shunt',
        createdAt: '2026-03-01T10:00:00Z',
        finalScore: 60,
        ...KNEES,
      }),
      entry({
        missionId: 'new2',
        templateId: 'blood-shunt',
        createdAt: '2026-03-08T10:00:00Z',
        finalScore: 66,
        ...KNEES,
      }),
    ]);

    expect(groups.map((group) => group.templateId)).toEqual(['blood-shunt', 'hull-breach']);
    expect(groups[1].series[0].points.map((point) => point.missionId)).toEqual(['old1', 'old2']);
  });

  it('files a mission under its scheduled time when it has one', () => {
    const groups = buildMovementProgression([
      entry({
        missionId: 'later-created',
        createdAt: '2026-06-01T10:00:00Z',
        scheduledAt: '2026-01-01T10:00:00Z',
        finalScore: 40,
        ...KNEES,
      }),
      entry({
        missionId: 'earlier-created',
        createdAt: '2026-02-01T10:00:00Z',
        scheduledAt: '2026-02-01T10:00:00Z',
        finalScore: 45,
        ...KNEES,
      }),
    ]);

    expect(groups[0].series[0].points.map((point) => point.missionId)).toEqual([
      'later-created',
      'earlier-created',
    ]);
  });

  it('reports a decline honestly rather than hiding it', () => {
    const groups = buildMovementProgression([
      entry({ missionId: 'm1', createdAt: '2026-01-01T10:00:00Z', finalScore: 50, ...KNEES }),
      entry({ missionId: 'm2', createdAt: '2026-01-08T10:00:00Z', finalScore: 44, ...KNEES }),
    ]);

    expect(formatProgressionDelta(groups[0].series[0])).toBe('−6 reps');
  });

  it('has no delta for a single attempt', () => {
    const groups = buildMovementProgression([
      entry({ missionId: 'm1', createdAt: '2026-01-01T10:00:00Z', finalScore: 48, ...KNEES }),
      entry({ missionId: 'm2', createdAt: '2026-02-01T10:00:00Z', finalScore: 36 }),
    ]);

    for (const series of groups[0].series) {
      expect(formatProgressionDelta(series)).toBeNull();
    }
  });

  it('says so when a version held level', () => {
    const groups = buildMovementProgression([
      entry({ missionId: 'm1', createdAt: '2026-01-01T10:00:00Z', finalScore: 44, ...KNEES }),
      entry({ missionId: 'm2', createdAt: '2026-01-08T10:00:00Z', finalScore: 44, ...KNEES }),
    ]);

    expect(formatProgressionDelta(groups[0].series[0])).toBe('no change');
  });
});
