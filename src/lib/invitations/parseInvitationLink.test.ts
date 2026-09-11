import { describe, expect, it } from 'vitest';
import { isStandaloneInvitationLink, parseInvitationLink } from './parseInvitationLink';

const MISSION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('parseInvitationLink', () => {
  it('reads a rally join link', () => {
    expect(parseInvitationLink(`https://amrapwithfriends.com/join?m=${MISSION}&card=f`)).toEqual({
      kind: 'mission',
      missionId: MISSION,
    });
  });

  it('reads a mission path', () => {
    expect(parseInvitationLink(`https://amrapwithfriends.com/mission/${MISSION}`)).toEqual({
      kind: 'mission',
      missionId: MISSION,
    });
  });

  it('reads a campaign invite code without treating it as a mission', () => {
    expect(parseInvitationLink('https://amrapwithfriends.com/campaign/join?c=ABC123')).toEqual({
      kind: 'campaign',
      inviteCode: 'ABC123',
    });
  });

  it('ignores ordinary pastes', () => {
    expect(parseInvitationLink('https://example.com/join?m=nope')).toBeNull();
    expect(parseInvitationLink('see you at https://amrapwithfriends.com')).toBeNull();
  });

  it('rejects lookalike hosts even when the path is a real mission URL', () => {
    expect(parseInvitationLink(`https://evil.com/mission/${MISSION}`)).toBeNull();
    expect(parseInvitationLink(`https://evil.example/mission/${MISSION}`)).toBeNull();
    expect(
      parseInvitationLink(`https://amrapwithfriends.com.evil.com/mission/${MISSION}`)
    ).toBeNull();
    expect(parseInvitationLink(`https://notvercel.app/mission/${MISSION}`)).toBeNull();
  });

  it('still recognizes localhost, loopback, and Vercel preview hosts', () => {
    expect(parseInvitationLink(`https://localhost/mission/${MISSION}`)).toEqual({
      kind: 'mission',
      missionId: MISSION,
    });
    expect(parseInvitationLink(`http://127.0.0.1/mission/${MISSION}`)).toEqual({
      kind: 'mission',
      missionId: MISSION,
    });
    expect(
      parseInvitationLink(`https://amrap-with-friends-abc.vercel.app/mission/${MISSION}`)
    ).toEqual({
      kind: 'mission',
      missionId: MISSION,
    });
    expect(parseInvitationLink(`https://www.amrapwithfriends.com/mission/${MISSION}`)).toEqual({
      kind: 'mission',
      missionId: MISSION,
    });
  });

  it('only treats a whole-field paste as a standalone invite', () => {
    expect(isStandaloneInvitationLink(`https://amrapwithfriends.com/join?m=${MISSION}`)).toBe(true);
    expect(
      isStandaloneInvitationLink(`join me https://amrapwithfriends.com/join?m=${MISSION}`)
    ).toBe(false);
  });
});
