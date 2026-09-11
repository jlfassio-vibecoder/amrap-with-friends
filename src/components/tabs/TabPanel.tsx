import type { ReactNode } from 'react';
import { panelIdFor, tabIdFor } from '@/components/tabs/tabIds';

interface TabPanelProps<K extends string> {
  /** Must match the TopTabs alongside it, or the aria wiring points at nothing. */
  namespace: string;
  tab: K;
  activeTab: K;
  /** Vertical rhythm inside the panel; pages differ and neither is wrong. */
  spacing?: string;
  children: ReactNode;
}

/**
 * Mounts children only while selected.
 *
 * Not merely hidden: an unselected panel's effects never run, which is what
 * keeps a dashboard from firing every tab's fetches on load.
 */
export function TabPanel<K extends string>({
  namespace,
  tab,
  activeTab,
  spacing = 'space-y-4',
  children,
}: TabPanelProps<K>) {
  const selected = tab === activeTab;

  return (
    <section
      id={panelIdFor(namespace, tab)}
      role="tabpanel"
      aria-labelledby={tabIdFor(namespace, tab)}
      hidden={!selected}
      className={selected ? spacing : undefined}
    >
      {selected ? children : null}
    </section>
  );
}
