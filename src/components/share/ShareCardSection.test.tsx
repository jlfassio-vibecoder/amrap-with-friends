import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MissionScorecard } from '@/components/MissionScorecard';
import type { LeaderboardEntry } from '@/lib/missionSync/types';

const { fetchReplayData } = vi.hoisted(() => ({ fetchReplayData: vi.fn() }));
vi.mock('@/lib/share/replayData', () => ({ fetchReplayData }));

function entry(): LeaderboardEntry {
  return {
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
  } as LeaderboardEntry;
}

function renderScorecard(props: Record<string, unknown>) {
  return render(
    <MemoryRouter>
      <MissionScorecard
        entry={entry()}
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
  afterEach(() => {
    cleanup();
    fetchReplayData.mockReset();
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
