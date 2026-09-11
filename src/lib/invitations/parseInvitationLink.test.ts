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

  it('only treats a whole-field paste as a standalone invite', () => {
    expect(isStandaloneInvitationLink(`https://amrapwithfriends.com/join?m=${MISSION}`)).toBe(true);
    expect(
      isStandaloneInvitationLink(`join me https://amrapwithfriends.com/join?m=${MISSION}`)
    ).toBe(false);
  });
});
