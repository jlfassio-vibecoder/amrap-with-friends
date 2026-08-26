import { describe, expect, it } from 'vitest';
import { ACTIVITY_CATEGORIES, ALL_ACTIVITY_TYPE_IDS, findActivityLabel } from './activityTypes';

describe('activityTypes', () => {
  it('has no duplicate activity ids across categories', () => {
    const seen = new Set<string>();
    for (const id of ALL_ACTIVITY_TYPE_IDS) {
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
  });

  it('has no duplicate category ids', () => {
    const ids = ACTIVITY_CATEGORIES.map((category) => category.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every category has at least one activity', () => {
    for (const category of ACTIVITY_CATEGORIES) {
      expect(category.activities.length).toBeGreaterThan(0);
    }
  });

  it('finds a label for a known activity id', () => {
    expect(findActivityLabel('road_bike')).toBe('Road Bike');
  });

  it('returns null for an unknown activity id', () => {
    expect(findActivityLabel('not_a_real_activity')).toBeNull();
  });
});
