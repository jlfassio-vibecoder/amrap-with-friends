import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SessionScorecard } from './SessionScorecard';
import type { LeaderboardEntry } from '@/lib/sessionSync/types';

afterEach(() => {
  cleanup();
});

const entry: LeaderboardEntry = {
  participantId: 'participant-1',
  nickname: 'Athlete',
  roundCount: 3,
  partialReps: 5,
  repsPerRound: 40,
  baseScore: 125,
  pvi: 12.5,
  pviMultiplier: 1,
  pviClassification: 'Standard',
  pviVerdict: 'Acceptable degradation.',
  domainWeight: 1,
  finalScore: 129,
  rounds: [
    { roundNumber: 1, durationSec: 62 },
    { roundNumber: 2, durationSec: 65 },
    { roundNumber: 3, durationSec: 71 },
  ],
  isSelf: true,
};

const scorecardProps = {
  entry,
  durationMinutes: 15,
  onSave: vi.fn(),
  onClose: vi.fn(),
};

describe('SessionScorecard', () => {
  it('renders save button when saveState is idle', () => {
    render(
      <SessionScorecard
        {...scorecardProps}
        saveState="idle"
      />
    );

    expect(screen.getByRole('button', { name: 'Save to my account' })).toBeDefined();
  });

  it('renders saving label when saveState is saving', () => {
    render(
      <SessionScorecard
        {...scorecardProps}
        saveState="saving"
      />
    );

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDefined();
  });

  it('renders saved label when saveState is saved', () => {
    render(
      <SessionScorecard
        {...scorecardProps}
        saveState="saved"
      />
    );

    expect(screen.getByRole('button', { name: 'Saved to my account' })).toBeDefined();
  });

  it('shows unavailable message when saveState is unavailable', () => {
    render(
      <SessionScorecard
        {...scorecardProps}
        saveState="unavailable"
      />
    );

    expect(screen.queryByRole('button', { name: 'Save to my account' })).toBeNull();
    expect(screen.getByText(/can no longer be saved/i)).toBeDefined();
  });
});
