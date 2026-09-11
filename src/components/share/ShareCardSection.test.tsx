import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MissionScorecard } from '@/components/MissionScorecard';
import type { LeaderboardEntry } from '@/lib/missionSync/types';

const { fetchReplayData } = vi.hoisted(() => ({ fetchReplayData: vi.fn() }));
vi.mock('@/lib/share/replayData', () => ({ fetchReplayData }));
const { getMissionRoom } = vi.hoisted(() => ({ getMissionRoom: vi.fn() }));
vi.mock('@/lib/api/rooms', () => ({ getMissionRoom }));

// Fully typed, like the fixture in MissionScorecard.test.tsx: an `as` cast
// here would let a breaking change to LeaderboardEntry pass this test.
const entry: LeaderboardEntry = {
  participantId: 'p1',
  nickname: 'ShareTest',
  roundCount: 7,
  partialReps: 0,
  repsPerRound: 20,
  baseScore: 140,
  pvi: 166.2,
  pviMultiplier: 0.85,
  pviClassification: 'System Failure',
  pviVerdict: 'A complete tactical collapse.',
  domainWeight: 1,
  finalScore: 119,
  rounds: [
    { roundNumber: 1, durationSec: 8 },
    { roundNumber: 2, durationSec: 10 },
    { roundNumber: 3, durationSec: 10 },
  ],
  isSelf: true,
  modifiedMovements: [],
  movementVariants: {},
};

function renderScorecard(props: Record<string, unknown>) {
  return render(
    <MemoryRouter>
      <MissionScorecard
        entry={entry}
        durationMinutes={5}
        onClose={() => undefined}
        saveState="idle"
        onSave={() => undefined}
        {...props}
      />
    </MemoryRouter>
  );
}

describe('the share panel on the scorecard', () => {
  // Most missions have no room, and that is what this suite is about.
  beforeEach(() => {
    getMissionRoom.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
    fetchReplayData.mockReset();
    getMissionRoom.mockReset();
  });

  it('is offered after a plain one-off mission', async () => {
    // Regression: it used to render only inside the daisy-chain branch, so a
    // guest finishing a single mission -- who the card is actually for -- never
    // saw it. Found by running a real mission, not by a test.
    fetchReplayData.mockResolvedValue({ data: null, error: null });
    renderScorecard({ missionId: 'm1', templateId: 'the-piston' });
    expect(fetchReplayData).toHaveBeenCalledWith(expect.objectContaining({ missionId: 'm1' }));
  });

  it('is offered on a daisy-chained mission too', async () => {
    fetchReplayData.mockResolvedValue({ data: null, error: null });
    renderScorecard({
      missionId: 'm1',
      templateId: 'the-piston',
      rallyPointHref: '/rally-point/r1',
      rallyPointId: 'r1',
    });
    expect(fetchReplayData).toHaveBeenCalled();
  });

  it('asks for nothing when there is no mission to share', () => {
    renderScorecard({});
    expect(fetchReplayData).not.toHaveBeenCalled();
  });

  it('shows the score either way', () => {
    fetchReplayData.mockResolvedValue({ data: null, error: null });
    renderScorecard({ missionId: 'm1', templateId: 'the-piston' });
    expect(screen.getByText('119')).toBeTruthy();
  });
});

describe('waiting for the room before the card can be shared', () => {
  afterEach(() => {
    cleanup();
    fetchReplayData.mockReset();
    getMissionRoom.mockReset();
  });

  const replay = {
    mission: {
      id: 'm1',
      templateId: null,
      workout: [],
      capSeconds: 300,
      durationMinutes: 5,
      intensityTier: null,
      state: 'finished',
      startedAt: null,
      segmentIndex: 0,
    },
    participants: [
      {
        participantId: 'p1',
        userId: null,
        displayName: 'ShareTest',
        isMe: true,
        finalRounds: 7,
        finalReps: 0,
        finalScore: 119,
        role: 'athlete',
      },
    ],
    rounds: [],
  };

  it('renders nothing until the room lookup settles', async () => {
    // The panel's buttons are live the moment it renders. Rendering on the
    // replay alone let a fast tap download the card -- and upload the link's
    // OG image, which is written once -- in the house colours while the room
    // lookup was still in flight.
    fetchReplayData.mockResolvedValue({ data: replay, error: null });
    let settle: (value: unknown) => void = () => undefined;
    getMissionRoom.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      })
    );

    renderScorecard({ missionId: 'm1', templateId: 'the-piston' });

    await waitFor(() => expect(fetchReplayData).toHaveBeenCalled());
    expect(screen.queryByText('Share the card')).toBeNull();

    settle(null);
    await waitFor(() => expect(screen.queryByText('Share the card')).not.toBeNull());
  });

  it('treats a failed lookup as an answer, not as a reason to hide the card', async () => {
    // getMissionRoom answers null on failure. Sharing is additive: a branding
    // lookup that fails must cost the athlete the brand, never the card.
    fetchReplayData.mockResolvedValue({ data: replay, error: null });
    getMissionRoom.mockResolvedValue(null);

    renderScorecard({ missionId: 'm1', templateId: 'the-piston' });

    await waitFor(() => expect(screen.queryByText('Share the card')).not.toBeNull());
  });
});
