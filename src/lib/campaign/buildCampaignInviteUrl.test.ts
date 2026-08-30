import { describe, expect, it } from 'vitest';
import { buildCampaignInviteUrl } from './buildCampaignInviteUrl';

describe('buildCampaignInviteUrl', () => {
  it('builds a join URL with default female card', () => {
    expect(buildCampaignInviteUrl('ABC123', 'https://amrapwithfriends.com')).toBe(
      'https://amrapwithfriends.com/campaign/join?c=ABC123&card=f'
    );
  });

  it('escapes a code so it cannot break out of the query string', () => {
    expect(buildCampaignInviteUrl('A&b=c', 'https://x.test')).toBe(
      'https://x.test/campaign/join?c=A%26b%3Dc&card=f'
    );
  });

  it('bakes a male card when requested', () => {
    expect(buildCampaignInviteUrl('ABC123', 'https://amrapwithfriends.com', 'm')).toBe(
      'https://amrapwithfriends.com/campaign/join?c=ABC123&card=m'
    );
  });
});
