import { describe, expect, it } from 'vitest';
import { isMovementPattern } from '@/lib/smartRecovery/movementPatterns';
import { EXERCISE_PATTERN_TAGS } from './exercisePatternTags';

describe('exercisePatternTags', () => {
  it('defines tags for all 73 exercises', () => {
    expect(Object.keys(EXERCISE_PATTERN_TAGS).length).toBe(73);
  });

  it('assigns at least one valid pattern per exercise id', () => {
    for (const [id, patterns] of Object.entries(EXERCISE_PATTERN_TAGS)) {
      expect(patterns.length, id).toBeGreaterThan(0);
      for (const pattern of patterns) {
        expect(isMovementPattern(pattern), `${id}:${pattern}`).toBe(true);
      }
    }
  });
});
