import { describe, expect, it } from 'vitest';
import { participantsWhoAdvanced, roundCountsById } from '@/lib/missionSync/roundFlash';

describe('participantsWhoAdvanced', () => {
  it('flags an athlete whose count went up', () => {
    expect(participantsWhoAdvanced({ a: 3 }, { a: 4 })).toEqual(['a']);
  });

  it('says nothing when a count held', () => {
    expect(participantsWhoAdvanced({ a: 3 }, { a: 3 })).toEqual([]);
  });

  it('does not flash somebody who just appeared', () => {
    // Otherwise every athlete already in the room flashes the moment you join.
    expect(participantsWhoAdvanced({}, { a: 6 })).toEqual([]);
  });

  it('does not flash a count going down', () => {
    // That is a resync correcting an over-count, not work being done.
    expect(participantsWhoAdvanced({ a: 6 }, { a: 5 })).toEqual([]);
  });

  it('flags several at once', () => {
    expect(participantsWhoAdvanced({ a: 1, b: 1, c: 1 }, { a: 2, b: 1, c: 3 }).sort()).toEqual([
      'a',
      'c',
    ]);
  });
});

describe('roundCountsById', () => {
  it('reduces a roster to the counts the comparison needs', () => {
    expect(
      roundCountsById([
        { participantId: 'a', roundCount: 2 },
        { participantId: 'b', roundCount: 5 },
      ])
    ).toEqual({ a: 2, b: 5 });
  });
});
