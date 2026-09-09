import { describe, expect, it } from 'vitest';
import { buildCaption } from '@/lib/share/caption';

const bar = {
  participantId: 'p',
  displayName: 'Me',
  rounds: 7,
  reps: 12,
  rank: 1,
  highlight: true,
  progress: 1,
  flash: 0,
};

describe('buildCaption', () => {
  it('leads with the score and ends with the link', () => {
    expect(
      buildCaption({
        bar,
        workoutTitle: 'Hull Breach',
        durationMinutes: 12,
        shareId: 'abc12345',
        squadSize: 4,
      })
    ).toBe(
      '7 rounds + 12 · 12 min AMRAP · with 3 others\nJoin the next mission: amrapwithfriends.com'
    );
  });

  it('says "1 other", not "1 others"', () => {
    // A two-person mission is the common case for a first share.
    expect(
      buildCaption({
        bar,
        workoutTitle: 'x',
        durationMinutes: 3,
        shareId: 'abc12345',
        squadSize: 2,
      })
    ).toContain('with 1 other');
    expect(
      buildCaption({
        bar,
        workoutTitle: 'x',
        durationMinutes: 3,
        shareId: 'abc12345',
        squadSize: 2,
      })
    ).not.toContain('1 others');
  });

  it('says nothing about a squad that was just the athlete', () => {
    expect(
      buildCaption({
        bar,
        workoutTitle: 'x',
        durationMinutes: 20,
        shareId: 'abc12345',
        squadSize: 1,
      })
    ).toContain('20 min AMRAP\n');
  });

  it('still produces a usable caption with no score', () => {
    const caption = buildCaption({
      bar: null,
      workoutTitle: 'x',
      durationMinutes: 10,
      shareId: 'abc12345',
      squadSize: 1,
    });
    expect(caption.startsWith('10 min AMRAP')).toBe(true);
    expect(caption).toContain('amrapwithfriends.com');
  });
});
