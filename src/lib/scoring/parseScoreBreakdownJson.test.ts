import { describe, it, expect } from 'vitest';
import { parseScoreBreakdownJson } from './parseScoreBreakdownJson';

describe('parseScoreBreakdownJson', () => {
  it('parses legacy 5-field breakdown without pacing fields', () => {
    expect(
      parseScoreBreakdownJson({
        baseScore: 175,
        pvi: 0,
        pviMultiplier: 1.15,
        domainWeight: 1.5,
        finalScore: 302,
      })
    ).toEqual({
      baseScore: 175,
      pvi: 0,
      pviMultiplier: 1.15,
      domainWeight: 1.5,
      finalScore: 302,
    });
  });

  it('parses breakdown with roundCount and roundSplits', () => {
    expect(
      parseScoreBreakdownJson({
        baseScore: 175,
        pvi: 12.5,
        pviMultiplier: 1.15,
        domainWeight: 1.5,
        finalScore: 302,
        roundCount: 4,
        roundSplits: [60, 65, 71, 88],
      })
    ).toEqual({
      baseScore: 175,
      pvi: 12.5,
      pviMultiplier: 1.15,
      domainWeight: 1.5,
      finalScore: 302,
      roundCount: 4,
      roundSplits: [60, 65, 71, 88],
    });
  });

  it('drops invalid pacing fields when roundSplits length mismatches roundCount', () => {
    expect(
      parseScoreBreakdownJson({
        baseScore: 175,
        pvi: 0,
        pviMultiplier: 1.15,
        domainWeight: 1.5,
        finalScore: 302,
        roundCount: 4,
        roundSplits: [60, 65],
      })
    ).toEqual({
      baseScore: 175,
      pvi: 0,
      pviMultiplier: 1.15,
      domainWeight: 1.5,
      finalScore: 302,
    });
  });
});
