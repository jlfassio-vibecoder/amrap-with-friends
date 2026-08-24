import { describe, it, expect } from 'vitest';
import {
  buildParticipantRoster,
  getParticipantAvatarColor,
  getParticipantInitial,
  rosterEntriesForScrollList,
} from './buildParticipantRoster';
import type {
  LeaderboardEntry,
  SessionPresenceEntry,
} from '@/lib/sessionSync/types';

const SELF_ID = '11111111-1111-4111-8111-111111111111';
const ALICE_ID = '22222222-2222-4222-8222-222222222222';
const BOB_ID = '33333333-3333-4333-8333-333333333333';
const CAROL_ID = '44444444-4444-4444-8444-444444444444';

function leaderboardEntry(
  participantId: string,
  nickname: string,
  roundCount: number,
  baseScore = roundCount,
  adjustedScore = baseScore,
  isSelf = false
): LeaderboardEntry {
  return {
    participantId,
    nickname,
    roundCount,
    partialReps: 0,
    repsPerRound: 20,
    baseScore,
    pvi: null,
    pviMultiplier: 1.0,
    pviClassification: 'Standard',
    pviVerdict: '',
    adjustedScore,
    rounds: [],
    isSelf,
  };
}

function presenceEntry(
  participantId: string,
  nickname: string,
  isOnline: boolean
): SessionPresenceEntry {
  return {
    participantId,
    nickname,
    isOnline,
  };
}

describe('buildParticipantRoster', () => {
  it('sorts by adjusted score descending', () => {
    const roster = buildParticipantRoster(
      [
        leaderboardEntry(ALICE_ID, 'Alice', 2, 40, 40),
        leaderboardEntry(BOB_ID, 'Bob', 2, 40, 46),
      ],
      [],
      SELF_ID
    );

    expect(roster.map((entry) => entry.participantId)).toEqual([BOB_ID, ALICE_ID]);
    expect(roster[0].adjustedScore).toBe(46);
    expect(roster[0].rank).toBe(1);
    expect(roster[1].rank).toBe(2);
  });

  it('breaks adjusted-score ties by nickname', () => {
    const roster = buildParticipantRoster(
      [
        leaderboardEntry(ALICE_ID, 'Alice', 3, 60, 60),
        leaderboardEntry(BOB_ID, 'Bob', 3, 60, 60),
      ],
      [],
      SELF_ID
    );

    expect(roster.map((entry) => entry.nickname)).toEqual(['Alice', 'Bob']);
  });

  it('assigns contiguous ranks after sort', () => {
    const roster = buildParticipantRoster(
      [
        leaderboardEntry(ALICE_ID, 'Alice', 1),
        leaderboardEntry(BOB_ID, 'Bob', 2),
        leaderboardEntry(CAROL_ID, 'Carol', 0),
      ],
      [],
      SELF_ID
    );

    expect(roster.map((entry) => entry.rank)).toEqual([1, 2, 3]);
  });

  it('defaults isOnline to false when presence has not loaded', () => {
    const roster = buildParticipantRoster(
      [leaderboardEntry(ALICE_ID, 'Alice', 1)],
      [],
      SELF_ID
    );

    expect(roster[0].isOnline).toBe(false);
    expect(roster[0].roundCount).toBe(1);
  });

  it('merges online status from presence entries', () => {
    const roster = buildParticipantRoster(
      [leaderboardEntry(ALICE_ID, 'Alice', 1)],
      [presenceEntry(ALICE_ID, 'Alice', true)],
      SELF_ID
    );

    expect(roster[0].isOnline).toBe(true);
  });

  it('includes presence-only participants with zero rounds', () => {
    const roster = buildParticipantRoster(
      [],
      [presenceEntry(ALICE_ID, 'Alice', true)],
      SELF_ID
    );

    expect(roster).toEqual([
      {
        participantId: ALICE_ID,
        nickname: 'Alice',
        roundCount: 0,
        baseScore: 0,
        adjustedScore: 0,
        isOnline: true,
        isSelf: false,
        rank: 1,
      },
    ]);
  });

  it('marks the self participant', () => {
    const roster = buildParticipantRoster(
      [
        leaderboardEntry(SELF_ID, 'Justin', 4, 80, 80, true),
        leaderboardEntry(ALICE_ID, 'Alice', 9, 180, 180),
      ],
      [
        presenceEntry(SELF_ID, 'Justin', true),
        presenceEntry(ALICE_ID, 'Alice', true),
      ],
      SELF_ID
    );

    const selfEntry = roster.find((entry) => entry.participantId === SELF_ID);
    expect(selfEntry?.isSelf).toBe(true);
    expect(selfEntry?.rank).toBe(2);
  });
});

describe('rosterEntriesForScrollList', () => {
  it('excludes the self row while preserving ranks for others', () => {
    const roster = buildParticipantRoster(
      [
        leaderboardEntry(ALICE_ID, 'Alice', 9, 180, 180),
        leaderboardEntry(SELF_ID, 'Justin', 4, 80, 80, true),
      ],
      [],
      SELF_ID
    );

    const scrollEntries = rosterEntriesForScrollList(roster);

    expect(scrollEntries).toHaveLength(1);
    expect(scrollEntries[0].participantId).toBe(ALICE_ID);
    expect(scrollEntries[0].rank).toBe(1);
    expect(roster.find((entry) => entry.isSelf)?.rank).toBe(2);
  });
});

describe('avatar helpers', () => {
  it('derives initials from nicknames', () => {
    expect(getParticipantInitial('justin')).toBe('J');
    expect(getParticipantInitial('  maria  ')).toBe('M');
    expect(getParticipantInitial('   ')).toBe('?');
  });

  it('uses a deterministic palette color per participant id', () => {
    const color = getParticipantAvatarColor(ALICE_ID);
    expect(color).toBe(getParticipantAvatarColor(ALICE_ID));
    expect(color.startsWith('bg-')).toBe(true);
  });
});
