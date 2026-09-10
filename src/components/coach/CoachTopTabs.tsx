import { panelIdForCoachTab, tabIdForCoachTab, type CoachTabKey } from './coachTabIds';
import { COACH_TABS, type CoachTabDefinition } from './coachTabs';

interface CoachTopTabsProps {
  tabs?: readonly CoachTabDefinition[];
  activeTab: CoachTabKey;
  onChange: (tab: CoachTabKey) => void;
}

/** Underlined section tabs — visual/ARIA parity with HudTopTabs. */
export function CoachTopTabs({ tabs = COACH_TABS, activeTab, onChange }: CoachTopTabsProps) {
  return (
    <div className="-mx-1 overflow-x-auto pt-1">
      <div
        className="inline-flex min-w-full items-end gap-1.5 border-b border-divider px-1"
        role="tablist"
        aria-label="Coach sections"
      >
        {tabs.map((tab) => {
          const selected = tab.key === activeTab;
          const ariaLabel = tab.badge
            ? `${tab.label}, ${tab.badge.toLowerCase() === 'new' ? 'new applications' : tab.badge}`
            : undefined;
          return (
            <button
              key={tab.key}
              id={tabIdForCoachTab(tab.key)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelIdForCoachTab(tab.key)}
              aria-label={ariaLabel}
              tabIndex={selected ? 0 : -1}
              className={
                selected
                  ? 'relative -mb-px shrink-0 rounded-t-card border border-border border-b-page bg-page px-4 py-2.5 text-sm font-semibold text-ink shadow-sm'
                  : 'shrink-0 rounded-t-card border border-border border-b-transparent bg-surface px-4 py-2 text-sm font-semibold text-secondary hover:bg-page hover:text-ink'
              }
              onClick={() => onChange(tab.key)}
            >
              <span className="inline-flex items-center gap-2">
                {tab.label}
                {tab.badge ? (
                  <span className="text-xs font-semibold text-accent">{tab.badge}</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
