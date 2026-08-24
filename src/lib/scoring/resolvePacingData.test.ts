import { describe, it, expect } from 'vitest';
import { resolvePacingData } from './resolvePacingData';

describe('resolvePacingData', () => {
  it('prefers locked breakdown roundSplits when present', () => {
    expect(
      resolvePacingData({
        breakdown: {
          baseScore: 175,
          pvi: 0,
          pviMultiplier: 1,
          domainWeight: 1,
          finalScore: 175,
          roundCount: 3,
          roundSplits: [60, 65, 71],
        },
        roundCount: 2,
        partialReps: 5,
        liveRounds: [{ roundNumber: 1, durationSec: 50 }],
      })
    ).toEqual({
      roundCount: 3,
      partialReps: 5,
      roundSplits: [60, 65, 71],
    });
  });

  it('falls back to live rounds when breakdown lacks roundSplits', () => {
    expect(
      resolvePacingData({
        breakdown: {
          baseScore: 175,
          pvi: 0,
          pviMultiplier: 1,
          domainWeight: 1,
          finalScore: 175,
        },
        roundCount: 2,
        partialReps: 5,
        liveRounds: [
          { roundNumber: 1, durationSec: 62 },
          { roundNumber: 2, durationSec: 65 },
        ],
      })
    ).toEqual({
      roundCount: 2,
      partialReps: 5,
      roundSplits: [62, 65],
    });
  });
});
