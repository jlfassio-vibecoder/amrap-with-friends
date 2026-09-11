import { panelIdFor, tabIdFor } from '@/components/tabs/tabIds';
import type { HudTabKey } from './HudTopTabs';

export function panelIdForHudTab(tab: HudTabKey): string {
  return panelIdFor('hud', tab);
}

export function tabIdForHudTab(tab: HudTabKey): string {
  return tabIdFor('hud', tab);
}
