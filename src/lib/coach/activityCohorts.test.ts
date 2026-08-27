import { describe, it, expect } from 'vitest';
import { ACTIVITY_COHORTS, cohortToActivityBucketParam } from './activityCohorts';

describe('activityCohorts', () => {
  it('defines all six cohorts in recency order', () => {
    expect(ACTIVITY_COHORTS.map((c) => c.id)).toEqual([
      'all',
      'active_now',
      'last_24h',
      'last_3d',
      'last_7d',
      'lapsed',
    ]);
  });

  it('maps recency cohorts to their RPC bucket param', () => {
    expect(cohortToActivityBucketParam('last_24h')).toBe('last_24h');
    expect(cohortToActivityBucketParam('last_3d')).toBe('last_3d');
    expect(cohortToActivityBucketParam('last_7d')).toBe('last_7d');
    expect(cohortToActivityBucketParam('lapsed')).toBe('lapsed');
  });

  it('maps all/active_now to null (not a server-side bucket)', () => {
    expect(cohortToActivityBucketParam('all')).toBeNull();
    expect(cohortToActivityBucketParam('active_now')).toBeNull();
  });
});
