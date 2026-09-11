import type { TabDefinition } from '@/components/tabs/TopTabs';
import type { MyMissionsTabKey } from './myMissionsTabIds';

export type MyMissionsTabDefinition = TabDefinition<MyMissionsTabKey>;

export const MY_MISSIONS_TABS: readonly MyMissionsTabDefinition[] = [
  { key: 'missions', label: 'Missions' },
  { key: 'sent', label: 'Sent to you' },
  { key: 'campaigns', label: 'Campaigns' },
];
