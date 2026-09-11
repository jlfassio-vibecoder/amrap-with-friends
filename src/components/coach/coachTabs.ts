import type { TabDefinition } from '@/components/tabs/TopTabs';
import type { CoachTabKey } from './coachTabIds';

export type CoachTabDefinition = TabDefinition<CoachTabKey>;

export const COACH_TABS: readonly CoachTabDefinition[] = [
  { key: 'applications', label: 'Applications' },
  { key: 'rooms', label: 'Rooms' },
  { key: 'users', label: 'Users' },
  { key: 'funnels', label: 'Funnels' },
  { key: 'content-acquisition', label: 'Content & acquisition' },
  { key: 'reliability', label: 'Reliability' },
  { key: 'explore', label: 'Explore' },
];
