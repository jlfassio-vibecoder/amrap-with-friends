import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ScoreBreakdownDisplay } from '@/components/ScoreBreakdownDisplay';
import type { ScoreBreakdown } from '@/lib/scoring/types';

afterEach(cleanup);

const BREAKDOWN: ScoreBreakdown = {
  baseScore: 175,
  pvi: 4,
  pviMultiplier: 1.15,
  domainWeight: 1.2,
  finalScore: 241,
};

describe('ScoreBreakdownDisplay', () => {
  it('labels Base score as reps for a reps-countable workout', () => {
    render(<ScoreBreakdownDisplay breakdown={BREAKDOWN} repsPerRound={40} />);
    expect(screen.getByText('Base score (reps)')).toBeTruthy();
  });

  it('labels Base score as rounds for a round-based workout', () => {
    render(<ScoreBreakdownDisplay breakdown={BREAKDOWN} repsPerRound={0} />);
    expect(screen.getByText('Base score (rounds)')).toBeTruthy();
  });

  it('omits the unit entirely when the caller does not know it', () => {
    render(<ScoreBreakdownDisplay breakdown={BREAKDOWN} />);
    expect(screen.getByText('Base score')).toBeTruthy();
    expect(screen.queryByText(/Base score \(/)).toBeNull();
  });

  it('always shows baseScore, never finalScore, in the Base score figure', () => {
    render(<ScoreBreakdownDisplay breakdown={BREAKDOWN} repsPerRound={40} />);
    expect(screen.getByText('175')).toBeTruthy();
    // 241 (finalScore) appears exactly once, in the Final score figure — not
    // duplicated into Base score.
    expect(screen.getAllByText('241')).toHaveLength(1);
  });
});
