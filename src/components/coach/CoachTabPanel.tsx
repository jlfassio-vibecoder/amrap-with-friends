import type { ReactNode } from 'react';
import { panelIdForCoachTab, tabIdForCoachTab, type CoachTabKey } from './coachTabIds';

interface CoachTabPanelProps {
  tab: CoachTabKey;
  activeTab: CoachTabKey;
  children: ReactNode;
}

/** Mounts children only while selected — same pattern as HUD / My missions panels. */
export function CoachTabPanel({ tab, activeTab, children }: CoachTabPanelProps) {
  const selected = tab === activeTab;

  return (
    <section
      id={panelIdForCoachTab(tab)}
      role="tabpanel"
      aria-labelledby={tabIdForCoachTab(tab)}
      hidden={!selected}
      className={selected ? 'space-y-8' : undefined}
    >
      {selected ? children : null}
    </section>
  );
}
