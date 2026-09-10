import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMyMissions = vi.fn();
const submitParticipantResult = vi.fn();

vi.mock('@/lib/api/myMissions', () => ({
  fetchMyMissions: (...args: unknown[]) => fetchMyMissions(...args),
}));

vi.mock('@/lib/api/missionSync', () => ({
  submitParticipantResult: (...args: unknown[]) => submitParticipantResult(...args),
}));

import { repairUnlockedAmqapScores } from './repairUnlockedAmqapScores';

function entry(overrides: Record<string, unknown> = {}) {
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
    workout: [{ name: '90/90', target: 10, unit: 'reps' }],
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

describe('repairUnlockedAmqapScores', () => {
  beforeEach(() => {
    fetchMyMissions.mockReset();
    submitParticipantResult.mockReset();
  });

  it('locks each unlocked finished AMQAP with partialReps 0', async () => {
    fetchMyMissions.mockResolvedValue({
      data: [
        entry({ missionId: 'm1', participantId: 'p1' }),
        entry({ missionId: 'm2', templateId: 'the-pendulum' }),
      ],
      error: null,
    });
    submitParticipantResult.mockResolvedValue({
      data: {
        ok: true,
        participantId: 'p1',
        segmentIndex: 0,
        partialReps: 0,
        repsPerRound: 10,
        finalScore: 0,
        scoreBreakdown: {},
      },
      error: null,
    });

    const result = await repairUnlockedAmqapScores();

    expect(result).toEqual({ attempted: 1, locked: 1 });
    expect(submitParticipantResult).toHaveBeenCalledTimes(1);
    expect(submitParticipantResult).toHaveBeenCalledWith(
      expect.objectContaining({
        missionId: 'm1',
        participantId: 'p1',
        claimToken: '',
        partialReps: 0,
        segmentIndex: 0,
      })
    );
  });

  it('counts score_already_locked as repaired', async () => {
    fetchMyMissions.mockResolvedValue({ data: [entry()], error: null });
    submitParticipantResult.mockResolvedValue({
      data: { ok: false, reason: 'score_already_locked' },
      error: null,
    });

    expect(await repairUnlockedAmqapScores()).toEqual({ attempted: 1, locked: 1 });
  });

  it('returns zeros when my_missions fails', async () => {
    fetchMyMissions.mockResolvedValue({ data: null, error: { message: 'nope' } });
    expect(await repairUnlockedAmqapScores()).toEqual({ attempted: 0, locked: 0 });
    expect(submitParticipantResult).not.toHaveBeenCalled();
  });
});
