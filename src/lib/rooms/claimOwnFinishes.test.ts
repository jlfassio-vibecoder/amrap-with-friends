import { describe, expect, it } from 'vitest';
import { ownUnclaimedFinishes } from '@/lib/rooms/claimOwnFinishes';
import type { RoomFeedRow } from '@/lib/rooms/roomFeed';

function row(overrides: Partial<RoomFeedRow> = {}): RoomFeedRow {
  return {
    participantId: 'p1',
    missionId: 'm1',
    templateId: null,
    nickname: null,
    score: 140,
    unit: 'reps',
    finishedAt: '2026-09-11T12:00:00.000Z',
    reactionCount: 0,
    ...overrides,
  };
}

const mine = (missionId: string) => (missionId === 'm1' ? 'p1' : null);
const token = (missionId: string) => (missionId === 'm1' ? 'tok-1' : null);

describe('ownUnclaimedFinishes', () => {
  it('finds a row this device can prove is its own', () => {
    expect(ownUnclaimedFinishes([row()], mine, token)).toEqual([
      { participantId: 'p1', claimToken: 'tok-1' },
    ]);
  });

  it('leaves someone else’s row alone', () => {
    expect(ownUnclaimedFinishes([row({ participantId: 'p9' })], mine, token)).toEqual([]);
    expect(ownUnclaimedFinishes([row({ missionId: 'm2' })], mine, token)).toEqual([]);
  });

  it('needs the claim token, not just the participant id', () => {
    // The id alone proves nothing; the token is what the RPC checks.
    expect(ownUnclaimedFinishes([row()], mine, () => null)).toEqual([]);
  });

  it('skips a row that already carries a name', () => {
    expect(ownUnclaimedFinishes([row({ nickname: 'Dana' })], mine, token)).toEqual([]);
  });

  it('claims a participant once even when it has several rows', () => {
    // Claiming attaches the participant, not the result, so a multi-segment
    // mission must not fire the same claim twice.
    const rows = [row(), row({ finishedAt: '2026-09-11T12:10:00.000Z' })];
    expect(ownUnclaimedFinishes(rows, mine, token)).toHaveLength(1);
  });
});
