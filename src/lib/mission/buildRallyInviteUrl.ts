import { withOgCard, type OgCard } from '@/lib/share/ogCard';

export function buildRallyInviteUrl(missionId: string, origin: string, card: OgCard = 'f'): string {
  return withOgCard(`${origin}/join?m=${missionId}`, card);
}
