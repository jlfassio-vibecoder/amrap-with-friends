import { describe, expect, it } from 'vitest';
import type { MyMissionEntry } from '@/lib/api/myMissions';
import type { MyMissionListItem } from '@/lib/mission/groupMyMissionsByRallyPoint';
import { groupMyMissionRepeats, myMissionRepeatKey } from './groupMyMissionRepeats';

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
    durationMinutes: 10,
    workout: [{ name: 'Burpees', target: 10 }],
    movementCount: 1,
    repsPerRound: 10,
    templateId: 'the-pendulum',
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

describe('myMissionRepeatKey', () => {
  it('joins templateId and duration when templateId is set', () => {
    expect(myMissionRepeatKey(entry({ missionId: 'm1', durationMinutes: 15 }))).toBe(
      'the-pendulum|15'
    );
  });

  it('returns null when templateId is missing', () => {
    expect(myMissionRepeatKey(entry({ missionId: 'm1', templateId: null }))).toBeNull();
  });
});

describe('groupMyMissionRepeats', () => {
  it('collapses singles that share templateId and duration', () => {
    const older = entry({
      missionId: 'm-old',
      createdAt: '2026-09-04T10:00:00.000Z',
      finalScore: 8,
    });
    const newer = entry({
      missionId: 'm-new',
      createdAt: '2026-09-06T10:00:00.000Z',
      finalScore: 11,
    });

    const result = groupMyMissionRepeats([
      { kind: 'single', entry: older },
      { kind: 'single', entry: newer },
    ]);

    expect(result).toEqual([
      {
        kind: 'repeat',
        key: 'solo|the-pendulum|10',
        parent: newer,
        runs: [newer, older],
      },
    ]);
  });

  it('keeps different durations or templates separate', () => {
    const a = entry({
      missionId: 'm-a',
      createdAt: '2026-09-06T10:00:00.000Z',
      durationMinutes: 10,
    });
    const b = entry({
      missionId: 'm-b',
      createdAt: '2026-09-05T10:00:00.000Z',
      durationMinutes: 15,
    });
    const c = entry({
      missionId: 'm-c',
      createdAt: '2026-09-04T10:00:00.000Z',
      templateId: 'the-piston',
    });

    const result = groupMyMissionRepeats([
      { kind: 'single', entry: a },
      { kind: 'single', entry: b },
      { kind: 'single', entry: c },
    ]);

    expect(
      result.map((item) => (item.kind === 'single' ? item.entry.missionId : item.parent.missionId))
    ).toEqual(['m-a', 'm-b', 'm-c']);
  });

  it('does not merge null templateId singles', () => {
    const a = entry({
      missionId: 'm1',
      templateId: null,
      createdAt: '2026-09-06T10:00:00.000Z',
    });
    const b = entry({
      missionId: 'm2',
      templateId: null,
      createdAt: '2026-09-05T10:00:00.000Z',
    });

    expect(
      groupMyMissionRepeats([
        { kind: 'single', entry: a },
        { kind: 'single', entry: b },
      ])
    ).toEqual([
      { kind: 'single', entry: a },
      { kind: 'single', entry: b },
    ]);
  });

  it('passes a lone hub group through when nothing else shares its chain key', () => {
    const parent = entry({ missionId: 'm-parent', createdAt: '2026-09-06T10:00:00.000Z' });
    const child = entry({
      missionId: 'm-child',
      createdAt: '2026-09-05T10:00:00.000Z',
      templateId: 'whiplash',
    });
    const group: MyMissionListItem = {
      kind: 'group',
      rallyPointId: 'rp1',
      parent,
      chainLength: 2,
      children: [{ kind: 'started', position: 1, entry: child }],
    };
    const solo = entry({
      missionId: 'm-solo',
      createdAt: '2026-09-04T10:00:00.000Z',
      templateId: 'the-piston',
    });

    expect(groupMyMissionRepeats([group, { kind: 'single', entry: solo }])).toEqual([
      group,
      { kind: 'single', entry: solo },
    ]);
  });

  it('does not merge a solo mission with a chained mission of the same template', () => {
    const solo = entry({
      missionId: 'm-solo',
      createdAt: '2026-09-04T10:00:00.000Z',
      templateId: 'the-acid-bath',
      durationMinutes: 5,
    });
    const parent = entry({
      missionId: 'm-chain',
      createdAt: '2026-09-06T10:00:00.000Z',
      templateId: 'the-acid-bath',
      durationMinutes: 5,
      state: 'waiting',
    });
    const child = entry({
      missionId: 'm-sibling',
      createdAt: '2026-09-06T10:00:00.000Z',
      templateId: 'deltoid-demise',
      durationMinutes: 5,
    });
    const group: MyMissionListItem = {
      kind: 'group',
      rallyPointId: 'rp-new',
      parent,
      chainLength: 2,
      children: [{ kind: 'started', position: 1, entry: child }],
    };

    const result = groupMyMissionRepeats([group, { kind: 'single', entry: solo }]);

    expect(result).toEqual([group, { kind: 'single', entry: solo }]);
  });

  it('collapses two chain parents and spills the older hub’s started child', () => {
    const olderParent = entry({
      missionId: 'm-old-parent',
      createdAt: '2026-09-04T10:00:00.000Z',
      templateId: 'the-acid-bath',
      durationMinutes: 5,
    });
    const olderChild = entry({
      missionId: 'm-old-child',
      createdAt: '2026-09-04T11:00:00.000Z',
      templateId: 'core-melt',
      durationMinutes: 5,
    });
    const newerParent = entry({
      missionId: 'm-new-parent',
      createdAt: '2026-09-06T10:00:00.000Z',
      templateId: 'the-acid-bath',
      durationMinutes: 5,
      state: 'waiting',
    });
    const newerChild = entry({
      missionId: 'm-new-child',
      createdAt: '2026-09-06T10:00:00.000Z',
      templateId: 'deltoid-demise',
      durationMinutes: 5,
    });
    const olderGroup: MyMissionListItem = {
      kind: 'group',
      rallyPointId: 'rp-old',
      parent: olderParent,
      chainLength: 2,
      children: [{ kind: 'started', position: 1, entry: olderChild }],
    };
    const newerGroup: MyMissionListItem = {
      kind: 'group',
      rallyPointId: 'rp-new',
      parent: newerParent,
      chainLength: 2,
      children: [{ kind: 'started', position: 1, entry: newerChild }],
    };

    const result = groupMyMissionRepeats([olderGroup, newerGroup]);

    expect(result).toEqual([
      {
        kind: 'repeat',
        key: 'chain|the-acid-bath|5',
        parent: newerParent,
        runs: [newerParent, olderParent],
        chain: {
          rallyPointId: 'rp-new',
          chainLength: 2,
          children: [{ kind: 'started', position: 1, entry: newerChild }],
        },
      },
      { kind: 'single', entry: olderChild },
    ]);
  });

  it('folds a spilled chain child into an existing solo of the same template', () => {
    const soloCore = entry({
      missionId: 'm-solo-core',
      createdAt: '2026-09-05T10:00:00.000Z',
      templateId: 'core-melt',
      durationMinutes: 5,
    });
    const olderParent = entry({
      missionId: 'm-old-parent',
      createdAt: '2026-09-04T10:00:00.000Z',
      templateId: 'the-acid-bath',
      durationMinutes: 5,
    });
    const olderChild = entry({
      missionId: 'm-old-child',
      createdAt: '2026-09-04T11:00:00.000Z',
      templateId: 'core-melt',
      durationMinutes: 5,
    });
    const newerParent = entry({
      missionId: 'm-new-parent',
      createdAt: '2026-09-06T10:00:00.000Z',
      templateId: 'the-acid-bath',
      durationMinutes: 5,
    });
    const newerChild = entry({
      missionId: 'm-new-child',
      createdAt: '2026-09-06T10:00:00.000Z',
      templateId: 'deltoid-demise',
      durationMinutes: 5,
    });

    const result = groupMyMissionRepeats([
      {
        kind: 'group',
        rallyPointId: 'rp-old',
        parent: olderParent,
        chainLength: 2,
        children: [{ kind: 'started', position: 1, entry: olderChild }],
      },
      {
        kind: 'group',
        rallyPointId: 'rp-new',
        parent: newerParent,
        chainLength: 2,
        children: [{ kind: 'started', position: 1, entry: newerChild }],
      },
      { kind: 'single', entry: soloCore },
    ]);

    const coreRepeat = result.find(
      (item) => item.kind === 'repeat' && item.key === 'solo|core-melt|5'
    );
    expect(coreRepeat).toMatchObject({
      kind: 'repeat',
      parent: soloCore,
      runs: [soloCore, olderChild],
    });
  });

  it('sorts the final list by face-card time newest first', () => {
    const olderPairNew = entry({
      missionId: 'pair-new',
      createdAt: '2026-09-05T10:00:00.000Z',
      templateId: 'the-pendulum',
    });
    const olderPairOld = entry({
      missionId: 'pair-old',
      createdAt: '2026-09-04T10:00:00.000Z',
      templateId: 'the-pendulum',
    });
    const recentSolo = entry({
      missionId: 'solo',
      createdAt: '2026-09-06T10:00:00.000Z',
      templateId: 'the-piston',
    });

    const result = groupMyMissionRepeats([
      { kind: 'single', entry: olderPairOld },
      { kind: 'single', entry: olderPairNew },
      { kind: 'single', entry: recentSolo },
    ]);

    expect(result.map((item) => item.kind)).toEqual(['single', 'repeat']);
    expect(result[0]).toMatchObject({ kind: 'single', entry: recentSolo });
    expect(result[1]).toMatchObject({
      kind: 'repeat',
      key: 'solo|the-pendulum|10',
      parent: olderPairNew,
      runs: [olderPairNew, olderPairOld],
    });
  });
});
