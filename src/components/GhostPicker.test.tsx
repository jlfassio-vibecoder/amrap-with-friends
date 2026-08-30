import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GhostPicker } from './GhostPicker';

const fetchAvailableGhostsMock = vi.fn();
const setStoredGhostSelectionMock = vi.fn();
const onChange = vi.fn();

vi.mock('@/lib/api/ghost', () => ({
  fetchAvailableGhosts: (...args: unknown[]) => fetchAvailableGhostsMock(...args),
}));
vi.mock('@/lib/sessionIdentity', () => ({
  setStoredGhostSelection: (...args: unknown[]) => setStoredGhostSelectionMock(...args),
}));
vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: () => ({
    isAuthenticated: true,
    isAuthLoading: false,
  }),
}));

afterEach(() => {
  cleanup();
  fetchAvailableGhostsMock.mockReset();
  setStoredGhostSelectionMock.mockReset();
  onChange.mockReset();
});

describe('GhostPicker', () => {
  it('lists crew runs from the missed session and writes a selection', async () => {
    fetchAvailableGhostsMock.mockResolvedValue({
      data: {
        personalBest: null,
        friends: [
          {
            sessionId: 'live-1',
            participantId: 'crew-1',
            nickname: 'Maya',
            finalScore: 120,
            baseScore: 100,
            createdAt: '2026-10-05T12:00:00.000Z',
          },
        ],
      },
      error: null,
    });

    render(
      <GhostPicker
        sessionId="makeup-1"
        templateId="the-valve"
        durationMinutes={10}
        value={null}
        onChange={onChange}
      />
    );

    await waitFor(() => {
      expect(fetchAvailableGhostsMock).toHaveBeenCalledWith('the-valve', 10, 'makeup-1');
    });

    await waitFor(() => {
      expect(screen.getByText(/Race a crewmate from the session you missed/)).toBeTruthy();
    });

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'crew:crew-1' } });

    expect(setStoredGhostSelectionMock).toHaveBeenCalledWith(
      'makeup-1',
      expect.objectContaining({
        participantId: 'crew-1',
        nickname: 'Maya',
        finalScore: 120,
      })
    );
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ participantId: 'crew-1', nickname: 'Maya' })
    );
  });
});
