import { describe, expect, it } from 'vitest';
import { filterUnlockedFinishedAmqap, isUnlockedFinishedAmqap } from './isUnlockedFinishedAmqap';
import type { MyMissionEntry } from '@/lib/api/myMissions';

function entry(overrides: Partial<MyMissionEntry> = {}): MyMissionEntry {
  return {
    participantId: 'p1',
    nickname: 'Host',
    joinedAt: '2026-09-08T00:00:00.000Z',
    role: 'host',
    missionId: 'm1',
    createdAt: '2026-09-08T00:00:00.000Z',
    scheduledAt: null,
    isFeatured: false,
    durationMinutes: 15,
    workout: [],
    templateId: 'amqap-foundational-15',
    rallyPointId: null,
    chainItemCount: 0,
    chainUnstartedCount: 0,
    state: 'finished',
    segmentIndex: 0,
    roundCount: 0,
    partialReps: 0,
    finalScore: null,
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

describe('isUnlockedFinishedAmqap', () => {
  it('matches finished AMQAP without a locked score', () => {
    expect(isUnlockedFinishedAmqap(entry())).toBe(true);
  });

  it('rejects locked, non-AMQAP, or unfinished missions', () => {
    expect(isUnlockedFinishedAmqap(entry({ scoreBreakdown: { finalScore: 0 } as never }))).toBe(
      false
    );
    expect(isUnlockedFinishedAmqap(entry({ templateId: 'the-pendulum' }))).toBe(false);
    expect(isUnlockedFinishedAmqap(entry({ templateId: null }))).toBe(false);
    expect(isUnlockedFinishedAmqap(entry({ state: 'work' }))).toBe(false);
  });

  it('filters a list down to unlocked finished AMQAP only', () => {
    const rows = [
      entry({ missionId: 'a' }),
      entry({ missionId: 'b', templateId: 'the-pendulum' }),
      entry({ missionId: 'c', scoreBreakdown: { finalScore: 10 } as never }),
    ];
    expect(filterUnlockedFinishedAmqap(rows).map((row) => row.missionId)).toEqual(['a']);
  });
});
