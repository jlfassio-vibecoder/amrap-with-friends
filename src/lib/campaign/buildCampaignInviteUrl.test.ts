import { describe, expect, it } from 'vitest';
import { buildCampaignInviteUrl } from './buildCampaignInviteUrl';

describe('buildCampaignInviteUrl', () => {
  it('builds a join URL for the code', () => {
    expect(buildCampaignInviteUrl('ABC123', 'https://amrapwithfriends.com')).toBe(
      'https://amrapwithfriends.com/campaign/join?c=ABC123'
    );
  });

  it('escapes a code so it cannot break out of the query string', () => {
    expect(buildCampaignInviteUrl('A&b=c', 'https://x.test')).toBe(
      'https://x.test/campaign/join?c=A%26b%3Dc'
    );
  });
});
