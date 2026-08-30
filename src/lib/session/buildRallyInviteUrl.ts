import { withOgCard, type OgCard } from '@/lib/share/ogCard';

export function buildRallyInviteUrl(sessionId: string, origin: string, card: OgCard = 'f'): string {
  return withOgCard(`${origin}/join?s=${sessionId}`, card);
}
