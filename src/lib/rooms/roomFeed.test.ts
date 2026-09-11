import { describe, expect, it } from 'vitest';
import {
  feedLines,
  feedName,
  feedScore,
  shouldOfferNaming,
  type RoomFeedRow,
} from '@/lib/rooms/roomFeed';

function row(overrides: Partial<RoomFeedRow> = {}): RoomFeedRow {
  return {
    participantId: 'p1',
    missionId: 'm1',
    templateId: 'the-piston',
    nickname: 'Dana',
    score: 140,
    unit: 'reps',
    finishedAt: '2026-09-11T12:00:00.000Z',
    reactionCount: 0,
    ...overrides,
  };
}

describe('feedName', () => {
  it('uses the name when there is one', () => {
    expect(feedName('Dana', false)).toBe('Dana');
  });

  it('says the same thing for a guest and for a member who opted out', () => {
    // They are the same row by design: anything that told them apart would
    // leak the choice the opt-out exists to honour.
    expect(feedName(null, false)).toBe('An athlete');
  });

  it('says "You" only to the person whose row it is', () => {
    expect(feedName(null, true)).toBe('You');
  });

  it('does not treat a blank nickname as a name', () => {
    expect(feedName('   ', false)).toBe('An athlete');
  });
});

describe('feedScore', () => {
  it('carries the unit the workout is counted in', () => {
    expect(feedScore(140, 'reps')).toBe('140 reps');
    expect(feedScore(7, 'rounds')).toBe('7 rounds');
  });

  it('shows a dash rather than inventing a zero', () => {
    expect(feedScore(null, 'reps')).toBe('—');
  });
});

describe('feedLines', () => {
  const own = (missionId: string) => (missionId === 'm1' ? 'p1' : null);

  it('recognises this device’s own finish without asking the server', () => {
    const [mine, theirs] = feedLines([row({ nickname: null }), row({ missionId: 'm2' })], own);
    expect(mine?.isMine).toBe(true);
    expect(mine?.who).toBe('You');
    expect(theirs?.isMine).toBe(false);
  });

  it('does not claim a row from the same mission run by someone else', () => {
    const [line] = feedLines([row({ participantId: 'p9', nickname: null })], own);
    expect(line?.isMine).toBe(false);
    expect(line?.who).toBe('An athlete');
  });

  it('keeps a named athlete named even when it is their own row', () => {
    const [line] = feedLines([row()], own);
    expect(line?.isMine).toBe(true);
    expect(line?.who).toBe('Dana');
  });
});

describe('shouldOfferNaming', () => {
  it('offers when a signed-out athlete’s own finish is showing unnamed', () => {
    const lines = feedLines([row({ nickname: null })], () => 'p1');
    expect(shouldOfferNaming(lines, false)).toBe(true);
  });

  it('says nothing to someone with no finish here', () => {
    const lines = feedLines([row({ nickname: null })], () => null);
    expect(shouldOfferNaming(lines, false)).toBe(false);
  });

  it('says nothing when their row already carries their name', () => {
    const lines = feedLines([row()], () => 'p1');
    expect(shouldOfferNaming(lines, false)).toBe(false);
  });

  it('never pitches an account to someone who is signed in', () => {
    // Their row is unnamed because they opted out or have not joined. Neither
    // is answered by "make an account".
    const lines = feedLines([row({ nickname: null })], () => 'p1');
    expect(shouldOfferNaming(lines, true)).toBe(false);
  });
});
