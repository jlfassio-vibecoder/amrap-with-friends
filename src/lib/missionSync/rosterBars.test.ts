import { describe, expect, it } from 'vitest';
import {
  rosterBarPercent,
  rosterBarScore,
  rosterLeaderScore,
  shouldShowRosterBars,
} from '@/lib/missionSync/rosterBars';
import type { ParticipantRosterEntry } from '@/lib/missionSync/buildParticipantRoster';

const entry = (over: Partial<ParticipantRosterEntry>): ParticipantRosterEntry =>
  ({
    participantId: 'p',
    nickname: 'A',
    roundCount: 0,
    repsPerRound: 20,
    baseScore: 0,
    finalScore: 0,
    pvi: null,
    pviMultiplier: 1,
    pviClassification: 'Standard',
    pviVerdict: '',
    isOnline: true,
    isSelf: false,
    rank: 1,
    modifiedMovements: [],
    movementVariants: {},
    ...over,
  }) as ParticipantRosterEntry;

describe('rosterBarPercent', () => {
  it('fills the leader and scales everyone against them', () => {
    // The mock's fixed ceiling of 9 pegs a strong room full and leaves a slow
    // one looking empty; the leader is the honest ceiling.
    expect(rosterBarPercent(8, 8)).toBe(100);
    expect(rosterBarPercent(4, 8)).toBe(50);
  });

  it('is empty before anyone has scored', () => {
    expect(rosterBarPercent(0, 0)).toBe(0);
    expect(rosterBarPercent(5, 0)).toBe(0);
  });

  it('never overflows its track', () => {
    expect(rosterBarPercent(12, 8)).toBe(100);
  });

  it('ignores values that are not real numbers', () => {
    expect(rosterBarPercent(Number.NaN, 8)).toBe(0);
    expect(rosterBarPercent(-3, 8)).toBe(0);
  });
});

describe('rosterBarScore', () => {
  it('draws raw work while the clock runs', () => {
    // Live, the board ranks on baseScore -- the bar has to agree with the order.
    expect(rosterBarScore(entry({ baseScore: 120, finalScore: 99 }), 'work')).toBe(120);
  });

  it('draws the real result once locked', () => {
    expect(rosterBarScore(entry({ baseScore: 120, finalScore: 99 }), 'finished')).toBe(99);
  });
});

describe('rosterLeaderScore', () => {
  it('takes the top score in the room', () => {
    const roster = [entry({ baseScore: 60 }), entry({ baseScore: 140 }), entry({ baseScore: 20 })];
    expect(rosterLeaderScore(roster, 'work')).toBe(140);
  });

  it('is zero on an empty board', () => {
    expect(rosterLeaderScore([], 'work')).toBe(0);
  });
});

describe('shouldShowRosterBars', () => {
  it('draws them on the absolute board', () => {
    expect(shouldShowRosterBars('absolute')).toBe(true);
  });

  it('leaves the discipline board alone', () => {
    // Discipline ranks by PVI, where lower is better and the number is not a
    // quantity. A bar there would draw a race nobody is running.
    expect(shouldShowRosterBars('discipline')).toBe(false);
  });
});
