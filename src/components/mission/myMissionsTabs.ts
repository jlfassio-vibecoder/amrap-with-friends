import type { MyMissionsTabKey } from './myMissionsTabIds';

export interface MyMissionsTabDefinition {
  key: MyMissionsTabKey;
  label: string;
}

export const MY_MISSIONS_TABS: readonly MyMissionsTabDefinition[] = [
  { key: 'missions', label: 'Missions' },
  { key: 'sent', label: 'Sent to you' },
  { key: 'campaigns', label: 'Campaigns' },
];
