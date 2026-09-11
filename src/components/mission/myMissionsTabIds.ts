import { panelIdFor, tabIdFor } from '@/components/tabs/tabIds';

export type MyMissionsTabKey = 'missions' | 'sent' | 'campaigns';

export function panelIdForMyMissionsTab(tab: MyMissionsTabKey): string {
  return panelIdFor('my-missions', tab);
}

export function tabIdForMyMissionsTab(tab: MyMissionsTabKey): string {
  return tabIdFor('my-missions', tab);
}
