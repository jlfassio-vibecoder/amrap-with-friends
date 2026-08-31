import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ParticipantsPanel } from './ParticipantsPanel';
import type { LeaderboardEntry } from '@/lib/missionSync/types';

const SELF_ID = '11111111-1111-4111-8111-111111111111';

function leaderboardEntry(
  participantId: string,
  nickname: string,
  roundCount: number
): LeaderboardEntry {
  return {
    participantId,
    nickname,
    roundCount,
    partialReps: 0,
    repsPerRound: 20,
    baseScore: roundCount * 20,
    pvi: null,
    pviMultiplier: 1.0,
    pviClassification: 'Standard',
    pviVerdict: '',
    domainWeight: 1.0,
    finalScore: roundCount * 20,
    rounds: [],
    isSelf: participantId === SELF_ID,
  };
}

afterEach(() => {
  cleanup();
});

describe('ParticipantsPanel', () => {
  it('renders overflow footer when roster exceeds display limit', () => {
    const leaderboard = Array.from({ length: 99 }, (_, index) =>
      leaderboardEntry(
        `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        `Athlete ${index + 1}`,
        99 - index
      )
    );

    render(
      <ParticipantsPanel
        leaderboard={leaderboard}
        presence={[]}
        selfParticipantId={SELF_ID}
        phase="work"
      />
    );

    expect(screen.getByText('and 84 more')).toBeTruthy();
  });

  it('does not render a separate pinned self section', () => {
    const leaderboard = [
      leaderboardEntry(SELF_ID, 'Justin', 10),
      leaderboardEntry('22222222-2222-4222-8222-222222222222', 'Alice', 5),
    ];

    render(
      <ParticipantsPanel
        leaderboard={leaderboard}
        presence={[]}
        selfParticipantId={SELF_ID}
        phase="work"
      />
    );

    expect(screen.queryByLabelText('Your rank')).toBeNull();
    expect(screen.getByText('Justin (you)')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });
});
