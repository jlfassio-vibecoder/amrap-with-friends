import { describe, expect, it } from 'vitest';
import {
  ALL_MOVEMENT_PATTERNS,
  CATEGORY_DEFAULT_PATTERNS,
  MOVEMENT_PATTERN_LABELS,
  isMovementPattern,
  movementPatternLabel,
} from './movementPatterns';

describe('movementPatterns', () => {
  it('exposes non-empty unique labels for every pattern', () => {
    const labels = ALL_MOVEMENT_PATTERNS.map((id) => MOVEMENT_PATTERN_LABELS[id]);
    expect(new Set(labels).size).toBe(ALL_MOVEMENT_PATTERNS.length);
    for (const label of labels) {
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('movementPatternLabel returns the display copy', () => {
    expect(movementPatternLabel('core')).toBe('Core');
    expect(movementPatternLabel('upper-push')).toBe('Upper body push');
  });

  it('isMovementPattern guards invalid strings', () => {
    expect(isMovementPattern('upper-push')).toBe(true);
    expect(isMovementPattern('grip')).toBe(false);
    expect(isMovementPattern('')).toBe(false);
  });

  it('leaves localized-trap without a category default', () => {
    expect(CATEGORY_DEFAULT_PATTERNS['localized-trap']).toEqual([]);
  });

  it('assigns midline-tension to core by default', () => {
    expect(CATEGORY_DEFAULT_PATTERNS['midline-tension']).toEqual(['core']);
  });
});
