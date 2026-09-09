import type { HudTabKey } from './HudTopTabs';

export function panelIdForHudTab(tab: HudTabKey): string {
  return `hud-panel-${tab}`;
}
