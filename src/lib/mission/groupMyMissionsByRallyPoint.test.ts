import { describe, expect, it } from 'vitest';
import type { MissionChainItem } from '@/lib/api/missionChain';
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
    movementCount: 1,
    repsPerRound: 10,
    templateId: null,
    intensityTier: null,
    rallyPointId: null,
    state: 'finished',
    segmentIndex: 0,
    roundCount: 1,
    partialReps: 0,
    finalScore: null,
    hasScoreBreakdown: false,
    scoreBreakdown: null,
    modifiedMovements: [],
    movementVariants: {},
    rpe: null,
    sessionNotes: '',
    checkIns: {},
    coachWorkoutName: null,
    ...overrides,
  };
}

function chainItem(
  overrides: Partial<MissionChainItem> & Pick<MissionChainItem, 'id' | 'position'>
): MissionChainItem {
  return {
    durationMinutes: 5,
    workout: [{ name: 'Air Squats', target: 15 }],
    templateId: null,
    intensityTier: 3,
    startedMissionId: null,
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

  it('groups daisy siblings with newest as parent and older children ascending', () => {
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
        chainLength: 3,
        children: [
          { kind: 'started', position: 1, entry: oldest },
          { kind: 'started', position: 2, entry: middle },
        ],
      },
      { kind: 'single', entry: other },
    ]);
  });

  it('expands a planned chain under position 0 with queued slots in order', () => {
    const piston = entry({
      missionId: 'm1',
      createdAt: '2026-09-06T10:00:00.000Z',
      rallyPointId: 'rp-chain',
      templateId: 'the-piston',
      state: 'waiting',
    });
    const chain = [
      chainItem({
        id: 'c0',
        position: 0,
        templateId: 'the-piston',
        startedMissionId: 'm1',
      }),
      chainItem({
        id: 'c1',
        position: 1,
        templateId: 'the-metronome',
        workout: [{ name: 'Fast Air Squats', target: 15 }],
      }),
      chainItem({
        id: 'c2',
        position: 2,
        templateId: 'whiplash',
        workout: [{ name: 'Burpees', target: 10 }],
      }),
    ];

    const result = groupMyMissionsByRallyPoint([piston], { 'rp-chain': chain });

    expect(result).toEqual([
      {
        kind: 'group',
        rallyPointId: 'rp-chain',
        parent: piston,
        chainLength: 3,
        children: [
          { kind: 'queued', position: 1, chainItem: chain[1] },
          { kind: 'queued', position: 2, chainItem: chain[2] },
        ],
      },
    ]);
  });

  it('still expands when position 0 has no started_mission_id stamp', () => {
    const piston = entry({
      missionId: 'm1',
      createdAt: '2026-09-06T10:00:00.000Z',
      rallyPointId: 'rp-chain',
      templateId: 'the-piston',
      state: 'waiting',
    });
    const chain = [
      chainItem({ id: 'c0', position: 0, templateId: 'the-piston', startedMissionId: null }),
      chainItem({ id: 'c1', position: 1, templateId: 'the-metronome' }),
      chainItem({ id: 'c2', position: 2, templateId: 'whiplash' }),
    ];

    const result = groupMyMissionsByRallyPoint([piston], { 'rp-chain': chain });

    expect(result[0]).toMatchObject({
      kind: 'group',
      parent: piston,
      chainLength: 3,
      children: [
        { kind: 'queued', position: 1 },
        { kind: 'queued', position: 2 },
      ],
    });
  });

  it('mixes started and queued children after a chain advance', () => {
    const first = entry({
      missionId: 'm1',
      createdAt: '2026-09-06T09:00:00.000Z',
      rallyPointId: 'rp-chain',
      templateId: 'the-piston',
    });
    const second = entry({
      missionId: 'm2',
      createdAt: '2026-09-06T10:00:00.000Z',
      rallyPointId: 'rp-chain',
      templateId: 'the-metronome',
    });
    const chain = [
      chainItem({ id: 'c0', position: 0, templateId: 'the-piston', startedMissionId: 'm1' }),
      chainItem({
        id: 'c1',
        position: 1,
        templateId: 'the-metronome',
        startedMissionId: 'm2',
      }),
      chainItem({ id: 'c2', position: 2, templateId: 'whiplash' }),
    ];

    const result = groupMyMissionsByRallyPoint([second, first], { 'rp-chain': chain });

    expect(result).toEqual([
      {
        kind: 'group',
        rallyPointId: 'rp-chain',
        parent: first,
        chainLength: 3,
        children: [
          { kind: 'started', position: 1, entry: second },
          { kind: 'queued', position: 2, chainItem: chain[2] },
        ],
      },
    ]);
  });

  it('never renders the same mission as both the parent and a child', () => {
    // A guest who joined at mission 2 has no row for mission 1, so the
    // position-0 stamp resolves to nothing. The fallback must not then pick the
    // mission that is already stamped on position 1.
    const items = groupMyMissionsByRallyPoint([entry({ missionId: 'm2', rallyPointId: 'hub-1' })], {
      'hub-1': [
        chainItem({ id: 'c0', position: 0, startedMissionId: 'm1' }),
        chainItem({ id: 'c1', position: 1, startedMissionId: 'm2' }),
      ],
    });

    const rendered = items.flatMap((item) =>
      item.kind === 'group'
        ? [
            item.parent.missionId,
            ...item.children.flatMap((child) =>
              child.kind === 'started' ? [child.entry.missionId] : []
            ),
          ]
        : [item.entry.missionId]
    );

    expect(new Set(rendered).size).toBe(rendered.length);
  });
});
