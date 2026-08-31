import { describe, it, expect } from 'vitest';
import {
  buildParticipantRoster,
  compareAbsoluteRoster,
  compareDisciplineRoster,
  getParticipantAvatarColor,
  getParticipantInitial,
  rosterEntriesForDisplay,
  ROSTER_DISPLAY_LIMIT,
} from './buildParticipantRoster';
import type { LeaderboardEntry, MissionPresenceEntry } from '@/lib/missionSync/types';

const SELF_ID = '11111111-1111-4111-8111-111111111111';
const ALICE_ID = '22222222-2222-4222-8222-222222222222';
const BOB_ID = '33333333-3333-4333-8333-333333333333';
const CAROL_ID = '44444444-4444-4444-8444-444444444444';

function leaderboardEntry(
  participantId: string,
  nickname: string,
  roundCount: number,
  baseScore = roundCount,
  finalScore = baseScore,
  isSelf = false,
  pvi: number | null = null,
  pviMultiplier = 1.0,
  pviClassification = 'Standard',
  pviVerdict = '',
  repsPerRound = 20
): LeaderboardEntry {
  return {
    participantId,
    nickname,
    roundCount,
    partialReps: 0,
    repsPerRound,
    baseScore,
    pvi,
    pviMultiplier,
    pviClassification,
    pviVerdict,
    domainWeight: 1.0,
    finalScore,
    rounds: [],
    isSelf,
  };
}

function presenceEntry(
  participantId: string,
  nickname: string,
  isOnline: boolean
): MissionPresenceEntry {
  return {
    participantId,
    nickname,
    isOnline,
  };
}

function rosterDefaults(overrides: Record<string, unknown> = {}) {
  return {
    repsPerRound: 0,
    pvi: null,
    pviMultiplier: 1.0,
    pviClassification: 'Insufficient Data',
    pviVerdict: '',
    ...overrides,
  };
}

describe('buildParticipantRoster', () => {
  it('sorts by final score descending', () => {
    const roster = buildParticipantRoster(
      [leaderboardEntry(ALICE_ID, 'Alice', 2, 40, 40), leaderboardEntry(BOB_ID, 'Bob', 2, 40, 69)],
      [],
      SELF_ID
    );

    expect(roster.map((entry) => entry.participantId)).toEqual([BOB_ID, ALICE_ID]);
    expect(roster[0].finalScore).toBe(69);
    expect(roster[0].rank).toBe(1);
    expect(roster[1].rank).toBe(2);
  });

  it('breaks final-score ties by base score then nickname', () => {
    const roster = buildParticipantRoster(
      [
        leaderboardEntry(ALICE_ID, 'Alice', 3, 55, 60),
        leaderboardEntry(BOB_ID, 'Bob', 3, 60, 60),
        leaderboardEntry(CAROL_ID, 'Carol', 3, 60, 60),
      ],
      [],
      SELF_ID
    );

    expect(roster.map((entry) => entry.nickname)).toEqual(['Bob', 'Carol', 'Alice']);
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
    const roster = buildParticipantRoster([leaderboardEntry(ALICE_ID, 'Alice', 1)], [], SELF_ID);

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

  it('includes presence-only participants with zero rounds on absolute board', () => {
    const roster = buildParticipantRoster([], [presenceEntry(ALICE_ID, 'Alice', true)], SELF_ID);

    expect(roster).toEqual([
      {
        participantId: ALICE_ID,
        nickname: 'Alice',
        roundCount: 0,
        baseScore: 0,
        finalScore: 0,
        isOnline: true,
        isSelf: false,
        rank: 1,
        ...rosterDefaults(),
      },
    ]);
  });

  it('excludes presence-only participants from discipline board', () => {
    const roster = buildParticipantRoster(
      [],
      [presenceEntry(ALICE_ID, 'Alice', true)],
      SELF_ID,
      'discipline'
    );

    expect(roster).toEqual([]);
  });

  it('marks the self participant', () => {
    const roster = buildParticipantRoster(
      [
        leaderboardEntry(SELF_ID, 'Justin', 4, 80, 80, true),
        leaderboardEntry(ALICE_ID, 'Alice', 9, 180, 180),
      ],
      [presenceEntry(SELF_ID, 'Justin', true), presenceEntry(ALICE_ID, 'Alice', true)],
      SELF_ID
    );

    const selfEntry = roster.find((entry) => entry.participantId === SELF_ID);
    expect(selfEntry?.isSelf).toBe(true);
    expect(selfEntry?.rank).toBe(2);
  });

  it('ranks higher final score first on absolute board', () => {
    const roster = buildParticipantRoster(
      [
        leaderboardEntry(ALICE_ID, 'Alice', 10, 260, 300, false, 15, 1.0, 'Standard', 'Acceptable'),
        leaderboardEntry(BOB_ID, 'Bob', 9, 240, 280, false, 4, 1.15, 'Elite Pacing', 'Surgical'),
      ],
      [],
      SELF_ID,
      'absolute'
    );

    expect(roster[0].participantId).toBe(ALICE_ID);
    expect(roster[0].rank).toBe(1);
    expect(roster[1].participantId).toBe(BOB_ID);
    expect(roster[1].rank).toBe(2);
  });

  it('ranks lower P.V.I. first on discipline board', () => {
    const roster = buildParticipantRoster(
      [
        leaderboardEntry(ALICE_ID, 'Alice', 10, 260, 300, false, 15, 1.0, 'Standard', 'Acceptable'),
        leaderboardEntry(BOB_ID, 'Bob', 9, 240, 280, false, 4, 1.15, 'Elite Pacing', 'Surgical'),
      ],
      [],
      SELF_ID,
      'discipline'
    );

    expect(roster[0].participantId).toBe(BOB_ID);
    expect(roster[0].rank).toBe(1);
    expect(roster[1].participantId).toBe(ALICE_ID);
    expect(roster[1].rank).toBe(2);
  });

  it('breaks discipline ties by final score then nickname', () => {
    const roster = buildParticipantRoster(
      [
        leaderboardEntry(ALICE_ID, 'Alice', 10, 260, 300, false, 10, 1.0, 'Standard', 'Acceptable'),
        leaderboardEntry(BOB_ID, 'Bob', 9, 240, 280, false, 10, 1.15, 'Standard', 'Acceptable'),
      ],
      [],
      SELF_ID,
      'discipline'
    );

    expect(roster.map((entry) => entry.participantId)).toEqual([ALICE_ID, BOB_ID]);
  });

  it('excludes participants with null P.V.I. from discipline board', () => {
    const roster = buildParticipantRoster(
      [
        leaderboardEntry(ALICE_ID, 'Alice', 1, 20, 20, false, null),
        leaderboardEntry(BOB_ID, 'Bob', 2, 40, 40, false, 8, 1.15, 'Elite Pacing', 'Surgical'),
      ],
      [],
      SELF_ID,
      'discipline'
    );

    expect(roster).toHaveLength(1);
    expect(roster[0].participantId).toBe(BOB_ID);
  });

  it('ranks by base score during work when final scores differ', () => {
    const roster = buildParticipantRoster(
      [leaderboardEntry(ALICE_ID, 'Alice', 5, 120, 50), leaderboardEntry(BOB_ID, 'Bob', 4, 80, 90)],
      [],
      SELF_ID,
      'absolute',
      'work'
    );

    expect(roster.map((entry) => entry.participantId)).toEqual([ALICE_ID, BOB_ID]);
    expect(roster[0].baseScore).toBe(120);
  });

  it('ranks by final score when finished even if base score differs', () => {
    const roster = buildParticipantRoster(
      [leaderboardEntry(ALICE_ID, 'Alice', 5, 120, 50), leaderboardEntry(BOB_ID, 'Bob', 4, 80, 90)],
      [],
      SELF_ID,
      'absolute',
      'finished'
    );

    expect(roster.map((entry) => entry.participantId)).toEqual([BOB_ID, ALICE_ID]);
    expect(roster[0].finalScore).toBe(90);
  });
});

describe('roster comparators', () => {
  it('compareAbsoluteRoster prefers higher base score during work', () => {
    const higherBase = {
      participantId: ALICE_ID,
      nickname: 'Alice',
      roundCount: 3,
      repsPerRound: 20,
      baseScore: 120,
      finalScore: 50,
      pvi: 0,
      pviMultiplier: 1,
      pviClassification: 'Standard',
      pviVerdict: '',
      isOnline: false,
    };
    const lowerBase = {
      ...higherBase,
      participantId: BOB_ID,
      nickname: 'Bob',
      baseScore: 80,
      finalScore: 90,
    };

    expect(compareAbsoluteRoster(higherBase, lowerBase, 'work')).toBeLessThan(0);
    expect(compareAbsoluteRoster(higherBase, lowerBase, 'finished')).toBeGreaterThan(0);
  });

  it('compareAbsoluteRoster prefers higher base score on final-score ties when finished', () => {
    const higherBase = {
      participantId: ALICE_ID,
      nickname: 'Alice',
      roundCount: 3,
      repsPerRound: 20,
      baseScore: 60,
      finalScore: 60,
      pvi: 0,
      pviMultiplier: 1,
      pviClassification: 'Standard',
      pviVerdict: '',
      isOnline: false,
    };
    const lowerBase = { ...higherBase, participantId: BOB_ID, nickname: 'Bob', baseScore: 55 };

    expect(compareAbsoluteRoster(higherBase, lowerBase, 'finished')).toBeLessThan(0);
  });

  it('compareDisciplineRoster prefers lower P.V.I.', () => {
    const disciplined = {
      participantId: BOB_ID,
      nickname: 'Bob',
      roundCount: 3,
      repsPerRound: 40,
      baseScore: 240,
      finalScore: 280,
      pvi: 4,
      pviMultiplier: 1.15,
      pviClassification: 'Elite Pacing',
      pviVerdict: '',
      isOnline: false,
    };
    const leaky = { ...disciplined, participantId: ALICE_ID, nickname: 'Alice', pvi: 15 };

    expect(compareDisciplineRoster(disciplined, leaky)).toBeLessThan(0);
  });
});

describe('rosterEntriesForDisplay', () => {
  it('returns the first 15 entries and hidden count', () => {
    const leaderboard = Array.from({ length: 16 }, (_, index) =>
      leaderboardEntry(
        `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        `Athlete ${index + 1}`,
        16 - index
      )
    );

    const roster = buildParticipantRoster(leaderboard, [], SELF_ID);
    const { visible, hiddenCount } = rosterEntriesForDisplay(roster);

    expect(visible).toHaveLength(ROSTER_DISPLAY_LIMIT);
    expect(hiddenCount).toBe(1);
    expect(visible[0].rank).toBe(1);
    expect(visible[visible.length - 1].rank).toBe(ROSTER_DISPLAY_LIMIT);
  });

  it('includes self in the visible list at true rank', () => {
    const roster = buildParticipantRoster(
      [
        leaderboardEntry(ALICE_ID, 'Alice', 9, 180, 180),
        leaderboardEntry(SELF_ID, 'Justin', 4, 80, 80, true),
      ],
      [],
      SELF_ID
    );

    const { visible } = rosterEntriesForDisplay(roster);

    expect(visible).toHaveLength(2);
    expect(visible.find((entry) => entry.isSelf)?.rank).toBe(2);
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
