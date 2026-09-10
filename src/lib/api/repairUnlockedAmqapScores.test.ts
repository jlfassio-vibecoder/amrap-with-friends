import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchUnlockedAmqapMissions = vi.fn();
const submitParticipantResult = vi.fn();

vi.mock('@/lib/api/myMissions', () => ({
  fetchUnlockedAmqapMissions: (...args: unknown[]) => fetchUnlockedAmqapMissions(...args),
}));

vi.mock('@/lib/api/missionSync', () => ({
  submitParticipantResult: (...args: unknown[]) => submitParticipantResult(...args),
}));

import { repairUnlockedAmqapScores } from './repairUnlockedAmqapScores';

function entry(overrides: Record<string, unknown> = {}) {
  return {
    missionId: 'm1',
    participantId: 'p1',
    segmentIndex: 0,
    templateId: 'amqap-foundational-15',
    state: 'finished',
    ...overrides,
  };
}

describe('repairUnlockedAmqapScores', () => {
  beforeEach(() => {
    fetchUnlockedAmqapMissions.mockReset();
    submitParticipantResult.mockReset();
  });

  it('locks each unlocked finished AMQAP with partialReps 0', async () => {
    fetchUnlockedAmqapMissions.mockResolvedValue({
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
    fetchUnlockedAmqapMissions.mockResolvedValue({ data: [entry()], error: null });
    submitParticipantResult.mockResolvedValue({
      data: { ok: false, reason: 'score_already_locked' },
      error: null,
    });

    expect(await repairUnlockedAmqapScores()).toEqual({ attempted: 1, locked: 1 });
  });

  it('returns zeros when list_unlocked_amqap fails', async () => {
    fetchUnlockedAmqapMissions.mockResolvedValue({ data: null, error: { message: 'nope' } });
    expect(await repairUnlockedAmqapScores()).toEqual({ attempted: 0, locked: 0 });
    expect(submitParticipantResult).not.toHaveBeenCalled();
  });
});
