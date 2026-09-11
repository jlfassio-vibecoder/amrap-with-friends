import { TopTabs, type TabDefinition } from '@/components/tabs/TopTabs';

export type HudTabKey =
  'mission-health' | 'week-history' | 'domains' | 'benchmarks' | 'physical-activity';

export type HudTabDefinition = TabDefinition<HudTabKey>;

interface HudTopTabsProps {
  tabs: readonly HudTabDefinition[];
  activeTab: HudTabKey;
  onChange: (tab: HudTabKey) => void;
}

/** The shared section tabs, named for this page. Ids and ARIA are unchanged. */
export function HudTopTabs({ tabs, activeTab, onChange }: HudTopTabsProps) {
  return (
    <TopTabs
      namespace="hud"
      ariaLabel="HUD sections"
      tabs={tabs}
      activeTab={activeTab}
      onChange={onChange}
    />
  );
}
