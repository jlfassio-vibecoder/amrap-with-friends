import { describe, expect, it } from 'vitest';
import type { MyMissionEntry } from '@/lib/api/myMissions';
import { groupMyMissionsByRallyPoint } from './groupMyMissionsByRallyPoint';

function entry(
  overrides: Partial<MyMissionEntry> & Pick<MyMissionEntry, 'missionId'>
): MyMissionEntry {
  return {
    participantId: `p-${overrides.missionId}`,
    nickname: 'Host',
    joinedAt: overrides.createdAt ?? '2026-09-01T00:00:00.000Z',
    role: 'host',
    createdAt: '2026-09-01T00:00:00.000Z',
    scheduledAt: null,
    isFeatured: false,
    durationMinutes: 5,
    workout: [{ name: 'Burpees', target: 10 }],
    templateId: null,
    rallyPointId: null,
    state: 'finished',
    segmentIndex: 0,
    roundCount: 1,
    partialReps: 0,
    finalScore: null,
    scoreBreakdown: null,
    coachWorkoutName: null,
    ...overrides,
  };
}

describe('groupMyMissionsByRallyPoint', () => {
  it('keeps null rally_point_id and lone hub missions as singles', () => {
    const solo = entry({ missionId: 'm1', createdAt: '2026-09-06T10:00:00.000Z' });
    const loneHub = entry({
      missionId: 'm2',
      createdAt: '2026-09-05T10:00:00.000Z',
      rallyPointId: 'rp-alone',
    });

    expect(groupMyMissionsByRallyPoint([solo, loneHub])).toEqual([
      { kind: 'single', entry: solo },
      { kind: 'single', entry: loneHub },
    ]);
  });

  it('groups siblings with newest as parent and older children ascending', () => {
    const oldest = entry({
      missionId: 'm-old',
      createdAt: '2026-09-04T10:00:00.000Z',
      rallyPointId: 'rp1',
      templateId: 'the-piston',
    });
    const middle = entry({
      missionId: 'm-mid',
      createdAt: '2026-09-05T10:00:00.000Z',
      rallyPointId: 'rp1',
      templateId: 'whiplash',
    });
    const newest = entry({
      missionId: 'm-new',
      createdAt: '2026-09-06T10:00:00.000Z',
      rallyPointId: 'rp1',
      templateId: 'the-piston',
    });
    const other = entry({
      missionId: 'm-other',
      createdAt: '2026-09-05T12:00:00.000Z',
    });

    const result = groupMyMissionsByRallyPoint([newest, other, middle, oldest]);

    expect(result).toEqual([
      {
        kind: 'group',
        rallyPointId: 'rp1',
        parent: newest,
        children: [oldest, middle],
      },
      { kind: 'single', entry: other },
    ]);
  });
});
