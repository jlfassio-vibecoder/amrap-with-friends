import { describe, it, expect } from 'vitest';
import { EXERCISE_LIBRARY } from '@/data/exerciseLibrary';

/**
 * Guardrails for the `commonMistakes` content.
 *
 * The library shipped with 72 of 73 entries empty, and the movement pages
 * rendered the section only when it was populated — so the gap was invisible.
 * These keep it from reopening, and catch the failure mode that drafting by
 * movement family actually has: the same sentence pasted onto ten pages.
 */
describe('commonMistakes', () => {
  it('gives every movement at least two', () => {
    const thin = EXERCISE_LIBRARY.filter((exercise) => exercise.commonMistakes.length < 2).map(
      (exercise) => exercise.id
    );
    expect(thin).toEqual([]);
  });

  it('never repeats a mistake across movements', () => {
    const seen = new Map<string, string[]>();
    for (const exercise of EXERCISE_LIBRARY) {
      for (const mistake of exercise.commonMistakes) {
        const key = mistake.trim().toLowerCase();
        seen.set(key, [...(seen.get(key) ?? []), exercise.id]);
      }
    }
    const shared = [...seen.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([mistake, ids]) => `${mistake} — ${ids.join(', ')}`);
    expect(shared, 'write a mistake specific to each movement').toEqual([]);
  });

  it('keeps each one long enough to be specific and short enough to be a bullet', () => {
    const wrong: string[] = [];
    for (const exercise of EXERCISE_LIBRARY) {
      for (const mistake of exercise.commonMistakes) {
        if (mistake.trim().length < 20 || mistake.trim().length > 160) {
          wrong.push(`${exercise.id}: ${mistake.length} chars`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('reads as a sentence, not a fragment or a heading', () => {
    for (const exercise of EXERCISE_LIBRARY) {
      for (const mistake of exercise.commonMistakes) {
        expect(mistake.trim().endsWith('.'), `${exercise.id}: ${mistake}`).toBe(true);
        expect(mistake.trim()[0], `${exercise.id}: ${mistake}`).toBe(
          mistake.trim()[0].toUpperCase()
        );
      }
    }
  });

  it('does not repeat a movement own coaching cue back at the reader', () => {
    // A mistake that restates the cue tells the athlete nothing new. Compare on
    // the cue's distinctive words rather than exact text, since a restatement is
    // usually a reworded one.
    const offenders: string[] = [];
    for (const exercise of EXERCISE_LIBRARY) {
      const cueWords = new Set(
        exercise.coachingCue
          .toLowerCase()
          .replace(/[^a-z\s]/g, ' ')
          .split(/\s+/)
          .filter((word) => word.length > 4)
      );
      if (cueWords.size === 0) {
        continue;
      }
      for (const mistake of exercise.commonMistakes) {
        const words = mistake
          .toLowerCase()
          .replace(/[^a-z\s]/g, ' ')
          .split(/\s+/)
          .filter((word) => word.length > 4);
        if (words.length === 0) {
          continue;
        }
        const overlap = words.filter((word) => cueWords.has(word)).length / words.length;
        if (overlap > 0.6) {
          offenders.push(`${exercise.id}: "${mistake}"`);
        }
      }
    }
    expect(offenders, 'these echo the coaching cue instead of naming a fault').toEqual([]);
  });
});
