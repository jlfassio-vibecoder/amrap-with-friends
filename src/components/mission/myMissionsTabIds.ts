export type MyMissionsTabKey = 'missions' | 'sent' | 'campaigns';

export function panelIdForMyMissionsTab(tab: MyMissionsTabKey): string {
  return `my-missions-panel-${tab}`;
}

export function tabIdForMyMissionsTab(tab: MyMissionsTabKey): string {
  return `my-missions-tab-${tab}`;
}
