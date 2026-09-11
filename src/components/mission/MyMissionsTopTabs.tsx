import { TopTabs } from '@/components/tabs/TopTabs';
import { MY_MISSIONS_TABS, type MyMissionsTabDefinition } from './myMissionsTabs';
import type { MyMissionsTabKey } from './myMissionsTabIds';

interface MyMissionsTopTabsProps {
  tabs?: readonly MyMissionsTabDefinition[];
  activeTab: MyMissionsTabKey;
  onChange: (tab: MyMissionsTabKey) => void;
  sentUnreadCount?: number;
}

export function MyMissionsTopTabs({
  tabs = MY_MISSIONS_TABS,
  activeTab,
  onChange,
  sentUnreadCount = 0,
}: MyMissionsTopTabsProps) {
  // Which tab the count belongs to is this page's business, not the shared
  // component's -- it used to check `tab.key === 'sent'` inside the render
  // every page shared.
  const counted = tabs.map((tab) =>
    tab.key === 'sent' ? { ...tab, count: sentUnreadCount } : tab
  );

  return (
    <TopTabs
      namespace="my-missions"
      ariaLabel="My missions sections"
      tabs={counted}
      activeTab={activeTab}
      onChange={onChange}
    />
  );
}
