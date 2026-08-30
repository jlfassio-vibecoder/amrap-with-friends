import { withOgCard, type OgCard } from '@/lib/share/ogCard';

export function buildLobbyInviteUrl(lobbyId: string, origin: string, card: OgCard = 'f'): string {
  return withOgCard(`${origin}/join?l=${lobbyId}`, card);
}
