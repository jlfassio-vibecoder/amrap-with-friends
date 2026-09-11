import { panelIdFor, tabIdFor } from '@/components/tabs/tabIds';

export type CoachTabKey =
  | 'applications'
  | 'rooms'
  | 'users'
  | 'funnels'
  | 'content-acquisition'
  | 'reliability'
  | 'explore';

export function panelIdForCoachTab(tab: CoachTabKey): string {
  return panelIdFor('coach', tab);
}

export function tabIdForCoachTab(tab: CoachTabKey): string {
  return tabIdFor('coach', tab);
}
