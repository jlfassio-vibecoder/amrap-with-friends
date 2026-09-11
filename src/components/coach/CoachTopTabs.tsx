import { TopTabs } from '@/components/tabs/TopTabs';
import { COACH_TABS, type CoachTabDefinition } from './coachTabs';
import type { CoachTabKey } from './coachTabIds';

interface CoachTopTabsProps {
  tabs?: readonly CoachTabDefinition[];
  activeTab: CoachTabKey;
  onChange: (tab: CoachTabKey) => void;
}

export function CoachTopTabs({ tabs = COACH_TABS, activeTab, onChange }: CoachTopTabsProps) {
  // The badge's accessible name is built here rather than in the shared
  // component: "New" means new *applications* on this page and would mean
  // something else on another.
  const described = tabs.map((tab) =>
    tab.badge
      ? {
          ...tab,
          ariaLabel: `${tab.label}, ${tab.badge.toLowerCase() === 'new' ? 'new applications' : tab.badge}`,
        }
      : tab
  );

  return (
    <TopTabs
      namespace="coach"
      ariaLabel="Coach sections"
      tabs={described}
      activeTab={activeTab}
      onChange={onChange}
    />
  );
}
