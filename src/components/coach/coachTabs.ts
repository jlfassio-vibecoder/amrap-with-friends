import type { CoachTabKey } from './coachTabIds';

export interface CoachTabDefinition {
  key: CoachTabKey;
  label: string;
  badge?: string;
}

export const COACH_TABS: readonly CoachTabDefinition[] = [
  { key: 'applications', label: 'Applications' },
  { key: 'users', label: 'Users' },
  { key: 'funnels', label: 'Funnels' },
  { key: 'content-acquisition', label: 'Content & acquisition' },
  { key: 'reliability', label: 'Reliability' },
  { key: 'explore', label: 'Explore' },
];
