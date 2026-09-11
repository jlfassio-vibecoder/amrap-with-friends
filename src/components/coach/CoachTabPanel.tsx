import type { ReactNode } from 'react';
import { TabPanel } from '@/components/tabs/TabPanel';
import type { CoachTabKey } from './coachTabIds';

interface CoachTabPanelProps {
  tab: CoachTabKey;
  activeTab: CoachTabKey;
  children: ReactNode;
}

export function CoachTabPanel({ tab, activeTab, children }: CoachTabPanelProps) {
  return (
    <TabPanel namespace="coach" tab={tab} activeTab={activeTab} spacing="space-y-8">
      {children}
    </TabPanel>
  );
}
