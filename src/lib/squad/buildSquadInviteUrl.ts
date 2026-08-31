import { withOgCard, type OgCard } from '@/lib/share/ogCard';

/**
 * Personal squad invite URL. The code is the secret, same pattern as a
 * campaign invite — not a rally link (those stay mission/campaign share URLs).
 */
export function buildSquadInviteUrl(
  inviteCode: string,
  origin: string,
  card: OgCard = 'f'
): string {
  return withOgCard(`${origin}/squad/join?c=${encodeURIComponent(inviteCode)}`, card);
}
