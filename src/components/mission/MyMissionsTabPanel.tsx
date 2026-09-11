import type { ReactNode } from 'react';
import { TabPanel } from '@/components/tabs/TabPanel';
import type { MyMissionsTabKey } from './myMissionsTabIds';

interface MyMissionsTabPanelProps {
  tab: MyMissionsTabKey;
  activeTab: MyMissionsTabKey;
  children: ReactNode;
}

export function MyMissionsTabPanel({ tab, activeTab, children }: MyMissionsTabPanelProps) {
  return (
    <TabPanel namespace="my-missions" tab={tab} activeTab={activeTab}>
      {children}
    </TabPanel>
  );
}
