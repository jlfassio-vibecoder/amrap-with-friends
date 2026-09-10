import type { ReactNode } from 'react';
import {
  panelIdForMyMissionsTab,
  tabIdForMyMissionsTab,
  type MyMissionsTabKey,
} from './myMissionsTabIds';

interface MyMissionsTabPanelProps {
  tab: MyMissionsTabKey;
  activeTab: MyMissionsTabKey;
  children: ReactNode;
}

/** Mounts children only while selected — same pattern as HUD panels. */
export function MyMissionsTabPanel({ tab, activeTab, children }: MyMissionsTabPanelProps) {
  const selected = tab === activeTab;

  return (
    <section
      id={panelIdForMyMissionsTab(tab)}
      role="tabpanel"
      aria-labelledby={tabIdForMyMissionsTab(tab)}
      hidden={!selected}
      className={selected ? 'space-y-4' : undefined}
    >
      {selected ? children : null}
    </section>
  );
}
