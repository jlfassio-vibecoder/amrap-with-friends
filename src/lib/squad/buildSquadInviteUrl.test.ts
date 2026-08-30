import { describe, expect, it } from 'vitest';
import { buildSquadInviteUrl } from './buildSquadInviteUrl';

describe('buildSquadInviteUrl', () => {
  it('builds a join URL with default female card', () => {
    expect(buildSquadInviteUrl('ABC123XYZ0', 'https://amrapwithfriends.com')).toBe(
      'https://amrapwithfriends.com/squad/join?c=ABC123XYZ0&card=f'
    );
  });

  it('escapes a code so it cannot break out of the query string', () => {
    expect(buildSquadInviteUrl('A&b=c', 'https://x.test')).toBe(
      'https://x.test/squad/join?c=A%26b%3Dc&card=f'
    );
  });

  it('bakes a male card when requested', () => {
    expect(buildSquadInviteUrl('ABC123XYZ0', 'https://amrapwithfriends.com', 'm')).toBe(
      'https://amrapwithfriends.com/squad/join?c=ABC123XYZ0&card=m'
    );
  });
});
