import { panelIdFor, tabIdFor } from '@/components/tabs/tabIds';

export interface TabDefinition<K extends string = string> {
  key: K;
  label: string;
  /** Small text beside the label, e.g. "New". */
  badge?: string;
  /** A count pill, e.g. unread. Zero renders nothing, so callers can pass a raw count. */
  count?: number;
  /** Overrides the button's accessible name when the badge needs explaining. */
  ariaLabel?: string;
}

interface TopTabsProps<K extends string> {
  /** Prefix for tab and panel ids. Must match the TabPanel alongside it. */
  namespace: string;
  /** Names the tablist for a screen reader, e.g. "HUD sections". */
  ariaLabel: string;
  tabs: readonly TabDefinition<K>[];
  activeTab: K;
  onChange: (tab: K) => void;
}

/**
 * The underlined section tabs used across HUD, Coach, My missions and the room
 * dashboard.
 *
 * This was three copies before it was one. They were written independently and
 * then deliberately kept in "visual/ARIA parity" by hand -- their own comments
 * said so -- which is a maintenance promise nobody can keep across four
 * surfaces. They had already drifted: two generated tab ids from a helper and
 * one inlined the string, and only one supported a badge.
 *
 * Badges live on the tab definition rather than as props on this component,
 * because the previous versions took a `sentUnreadCount` and then checked
 * `tab.key === 'sent'` inside the render -- knowledge of one page's tab, in the
 * component every page shares.
 *
 * Deliberately no arrow-key roving. The original decision is recorded in
 * CoachTopTabs and holds: it would be a behaviour change to three shipped
 * surfaces, and it belongs in its own change if it is wanted.
 */
export function TopTabs<K extends string>({
  namespace,
  ariaLabel,
  tabs,
  activeTab,
  onChange,
}: TopTabsProps<K>) {
  return (
    <div className="-mx-1 overflow-x-auto pt-1">
      <div
        className="inline-flex min-w-full items-end gap-1.5 border-b border-divider px-1"
        role="tablist"
        aria-label={ariaLabel}
      >
        {tabs.map((tab) => {
          const selected = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              id={tabIdFor(namespace, tab.key)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelIdFor(namespace, tab.key)}
              aria-label={tab.ariaLabel}
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
                {tab.count !== undefined && tab.count > 0 ? (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-on-accent">
                    {tab.count > 9 ? '9+' : tab.count}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
