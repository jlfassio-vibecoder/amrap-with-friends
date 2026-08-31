import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SessionScorecard } from './SessionScorecard';
import type { LeaderboardEntry } from '@/lib/sessionSync/types';
import { DAISY_CHAIN_TOOLTIP } from '@/lib/session/daisyChainCopy';

const announceNextMissionMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('@/lib/api/rallyPoint', () => ({
  announceNextMission: (...args: unknown[]) => announceNextMissionMock(...args),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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

const RALLY_POINT_HREF = '/rally-point/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RALLY_POINT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('SessionScorecard', () => {
  it('renders save button when saveState is idle', () => {
    render(
      <MemoryRouter>
        <SessionScorecard {...scorecardProps} saveState="idle" />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: 'Save to my account' })).toBeDefined();
  });

  it('renders saving label when saveState is saving', () => {
    render(
      <MemoryRouter>
        <SessionScorecard {...scorecardProps} saveState="saving" />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDefined();
  });

  it('renders saved label when saveState is saved', () => {
    render(
      <MemoryRouter>
        <SessionScorecard {...scorecardProps} saveState="saved" />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: 'Saved to my account' })).toBeDefined();
  });

  it('shows unavailable message when saveState is unavailable', () => {
    render(
      <MemoryRouter>
        <SessionScorecard {...scorecardProps} saveState="unavailable" />
      </MemoryRouter>
    );

    expect(screen.queryByRole('button', { name: 'Save to my account' })).toBeNull();
    expect(screen.getByText(/can no longer be saved/i)).toBeDefined();
  });

  it('shows Daisy-chain CTA with tooltip and Back home when rallyPointHref is set', () => {
    render(
      <MemoryRouter>
        <SessionScorecard
          {...scorecardProps}
          saveState="saved"
          rallyPointHref={RALLY_POINT_HREF}
          rallyPointId={RALLY_POINT_ID}
          isHost
        />
      </MemoryRouter>
    );

    const daisy = screen.getByRole('button', { name: 'Daisy-chain another session' });
    expect(daisy.getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText(DAISY_CHAIN_TOOLTIP)).toBeDefined();
    const home = screen.getByRole('link', { name: 'Back home' });
    expect(home.getAttribute('href')).toBe('/');
  });

  it('announces then navigates when the host daisy-chains', async () => {
    announceNextMissionMock.mockResolvedValue({
      data: { ok: true, nextMissionPendingAt: '2026-09-01T12:00:00Z' },
      error: null,
    });

    render(
      <MemoryRouter>
        <SessionScorecard
          {...scorecardProps}
          saveState="saved"
          rallyPointHref={RALLY_POINT_HREF}
          rallyPointId={RALLY_POINT_ID}
          isHost
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Daisy-chain another session' }));

    await waitFor(() => {
      expect(announceNextMissionMock).toHaveBeenCalledWith(RALLY_POINT_ID);
      expect(navigateMock).toHaveBeenCalledWith(RALLY_POINT_HREF);
    });
  });

  it('navigates without announcing when a non-host daisy-chains', async () => {
    render(
      <MemoryRouter>
        <SessionScorecard
          {...scorecardProps}
          saveState="saved"
          rallyPointHref={RALLY_POINT_HREF}
          rallyPointId={RALLY_POINT_ID}
          isHost={false}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Daisy-chain another session' }));

    await waitFor(() => {
      expect(announceNextMissionMock).not.toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith(RALLY_POINT_HREF);
    });
  });
});
