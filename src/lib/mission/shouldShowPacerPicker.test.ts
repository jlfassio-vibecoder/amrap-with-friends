import { describe, expect, it } from 'vitest';
import { shouldShowPacerPicker } from '@/lib/mission/shouldShowPacerPicker';

describe('shouldShowPacerPicker', () => {
  it('offers a pacer on a templated mission in the rally point', () => {
    expect(shouldShowPacerPicker({ templateId: 'the-valve', phase: 'waiting' })).toBe(true);
  });

  it('offers a pacer to a squad, not only to someone training alone', () => {
    // The gate this replaced required participantCount === 1. Nothing about the
    // number of people in the mission reaches this decision any more, which is
    // the point: an athlete who modified a movement needs their own curve most
    // in a group.
    expect(shouldShowPacerPicker({ templateId: 'the-valve', phase: 'waiting' })).toBe(true);
  });

  it('offers nothing for an ad-hoc mission with no template to look up', () => {
    expect(shouldShowPacerPicker({ templateId: null, phase: 'waiting' })).toBe(false);
  });

  it('is a choice made before the clock starts', () => {
    for (const phase of ['work', 'finished', 'countdown']) {
      expect(shouldShowPacerPicker({ templateId: 'the-valve', phase })).toBe(false);
    }
  });
});
