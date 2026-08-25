import { describe, it, expect } from 'vitest';
import {
  canSetPerceivedClassification,
  compareClassificationRank,
  classificationRankOrdinal,
} from './compareClassificationRank';

describe('compareClassificationRank', () => {
  it('orders unclassified < civilian < operator < special_ops', () => {
    expect(classificationRankOrdinal('unclassified')).toBe(0);
    expect(compareClassificationRank('civilian', 'operator')).toBeLessThan(0);
    expect(compareClassificationRank('special_ops', 'civilian')).toBeGreaterThan(
      0
    );
    expect(compareClassificationRank('operator', 'operator')).toBe(0);
  });
});

describe('canSetPerceivedClassification', () => {
  it('allows the first claim and upgrades, rejects downgrades', () => {
    expect(canSetPerceivedClassification(null, 'civilian')).toBe(true);
    expect(canSetPerceivedClassification('civilian', 'operator')).toBe(true);
    expect(canSetPerceivedClassification('operator', 'operator')).toBe(true);
    expect(canSetPerceivedClassification('special_ops', 'operator')).toBe(false);
    expect(canSetPerceivedClassification('operator', 'civilian')).toBe(false);
  });
});
