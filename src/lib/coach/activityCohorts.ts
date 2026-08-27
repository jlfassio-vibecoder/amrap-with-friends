export type ActivityCohortId =
  | 'all'
  | 'active_now'
  | 'last_24h'
  | 'last_3d'
  | 'last_7d'
  | 'lapsed';

export interface ActivityCohortDefinition {
  id: ActivityCohortId;
  label: string;
  description: string;
}

export const ACTIVITY_COHORTS: ActivityCohortDefinition[] = [
  { id: 'all', label: 'All Users', description: 'Every user with an account.' },
  { id: 'active_now', label: 'Active Now', description: 'Has the app open right now.' },
  { id: 'last_24h', label: 'Past 24 Hours', description: 'Seen within the last day.' },
  { id: 'last_3d', label: 'Past 3 Days', description: 'Seen within the last 3 days.' },
  { id: 'last_7d', label: 'Past Week', description: 'Seen within the last 7 days.' },
  {
    id: 'lapsed',
    label: 'Lapsed',
    description: '7+ days since last seen — candidates for a "come back" nudge.',
  },
];

/** The RPC-level filter for a cohort, or null when it isn't a server-side bucket (all / active_now). */
export function cohortToActivityBucketParam(cohort: ActivityCohortId): string | null {
  if (cohort === 'all' || cohort === 'active_now') {
    return null;
  }
  return cohort;
}
