import { describe, expect, it } from 'vitest';
import { EXERCISE_LIBRARY } from '@/data/exerciseLibrary';
import { isMovementPattern } from '@/lib/smartRecovery/movementPatterns';
import { DRAFT_EXERCISE_PATTERNS, assertDraftCoversExerciseLibrary } from './draftExercisePatterns';

describe('draftExercisePatterns', () => {
  it('covers every exercise library id', () => {
    expect(() => assertDraftCoversExerciseLibrary()).not.toThrow();
    expect(Object.keys(DRAFT_EXERCISE_PATTERNS).length).toBe(EXERCISE_LIBRARY.length);
  });

  it('assigns at least one valid pattern per exercise', () => {
    for (const entry of EXERCISE_LIBRARY) {
      const patterns = DRAFT_EXERCISE_PATTERNS[entry.id];
      expect(patterns, entry.id).toBeDefined();
      expect(patterns!.length).toBeGreaterThan(0);
      for (const pattern of patterns!) {
        expect(isMovementPattern(pattern)).toBe(true);
      }
    }
  });
});
