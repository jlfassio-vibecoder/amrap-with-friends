import { withOgCard, type OgCard } from '@/lib/share/ogCard';

/**
 * The campaign equivalent of a rally link. The invite code is the secret, so
 * it travels in the URL exactly as a mission id does.
 */
export function buildCampaignInviteUrl(
  inviteCode: string,
  origin: string,
  card: OgCard = 'f'
): string {
  return withOgCard(`${origin}/campaign/join?c=${encodeURIComponent(inviteCode)}`, card);
}
