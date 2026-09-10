import {
  panelIdForMyMissionsTab,
  tabIdForMyMissionsTab,
  type MyMissionsTabKey,
} from './myMissionsTabIds';

export type { MyMissionsTabKey };

export interface MyMissionsTabDefinition {
  key: MyMissionsTabKey;
  label: string;
}

export const MY_MISSIONS_TABS: readonly MyMissionsTabDefinition[] = [
  { key: 'missions', label: 'Missions' },
  { key: 'sent', label: 'Sent to you' },
  { key: 'campaigns', label: 'Campaigns' },
];

interface MyMissionsTopTabsProps {
  tabs?: readonly MyMissionsTabDefinition[];
  activeTab: MyMissionsTabKey;
  onChange: (tab: MyMissionsTabKey) => void;
}

/** Underlined section tabs — visual/ARIA parity with HudTopTabs. */
export function MyMissionsTopTabs({
  tabs = MY_MISSIONS_TABS,
  activeTab,
  onChange,
}: MyMissionsTopTabsProps) {
  return (
    <div className="-mx-1 overflow-x-auto pt-1">
      <div
        className="inline-flex min-w-full items-end gap-1.5 border-b border-divider px-1"
        role="tablist"
        aria-label="My missions sections"
      >
        {tabs.map((tab) => {
          const selected = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              id={tabIdForMyMissionsTab(tab.key)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelIdForMyMissionsTab(tab.key)}
              tabIndex={selected ? 0 : -1}
              className={
                selected
                  ? 'relative -mb-px shrink-0 rounded-t-card border border-border border-b-page bg-page px-4 py-2.5 text-sm font-semibold text-ink shadow-sm'
                  : 'shrink-0 rounded-t-card border border-border border-b-transparent bg-surface px-4 py-2 text-sm font-semibold text-secondary hover:bg-page hover:text-ink'
              }
              onClick={() => onChange(tab.key)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
