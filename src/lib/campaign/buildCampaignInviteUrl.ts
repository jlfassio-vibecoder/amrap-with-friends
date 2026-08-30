/**
 * The campaign equivalent of a rally link. The invite code is the secret, so
 * it travels in the URL exactly as a session id does.
 */
export function buildCampaignInviteUrl(inviteCode: string, origin: string): string {
  return `${origin}/campaign/join?c=${encodeURIComponent(inviteCode)}`;
}
