import { describe, expect, it } from 'vitest';
import { shouldAutoLockAmqapScore } from './shouldAutoLockAmqapScore';

describe('shouldAutoLockAmqapScore', () => {
  const ready = {
    isAmqap: true,
    isPractice: false,
    phase: 'finished',
    hasSubmittedPartialReps: false,
    hasParticipant: true,
  };

  it('locks when a finished AMQAP has a participant and no score yet', () => {
    expect(shouldAutoLockAmqapScore(ready)).toBe(true);
  });

  it('does not lock metabolic missions, practice, or already-locked scores', () => {
    expect(shouldAutoLockAmqapScore({ ...ready, isAmqap: false })).toBe(false);
    expect(shouldAutoLockAmqapScore({ ...ready, isPractice: true })).toBe(false);
    expect(shouldAutoLockAmqapScore({ ...ready, phase: 'work' })).toBe(false);
    expect(shouldAutoLockAmqapScore({ ...ready, hasSubmittedPartialReps: true })).toBe(false);
    expect(shouldAutoLockAmqapScore({ ...ready, hasParticipant: false })).toBe(false);
  });
});
