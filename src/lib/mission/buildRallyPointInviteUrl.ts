import { withOgCard, type OgCard } from '@/lib/share/ogCard';

export function buildRallyPointInviteUrl(
  rallyPointId: string,
  origin: string,
  card: OgCard = 'f'
): string {
  return withOgCard(`${origin}/join?r=${rallyPointId}`, card);
}
