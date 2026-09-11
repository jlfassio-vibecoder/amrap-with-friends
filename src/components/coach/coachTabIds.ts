export type CoachTabKey =
  | 'applications'
  | 'rooms'
  | 'users'
  | 'funnels'
  | 'content-acquisition'
  | 'reliability'
  | 'explore';

export function panelIdForCoachTab(tab: CoachTabKey): string {
  return `coach-panel-${tab}`;
}

export function tabIdForCoachTab(tab: CoachTabKey): string {
  return `coach-tab-${tab}`;
}
