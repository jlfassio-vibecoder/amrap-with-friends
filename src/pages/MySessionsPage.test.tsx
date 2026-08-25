import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import MySessionsPage from './MySessionsPage';
import type { MySessionEntry } from '@/lib/api/mySessions';

const fetchMySessionsMock = vi.fn();
const deleteIncompleteSessionMock = vi.fn();
const authUser = { id: 'user-1' };

vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: () => ({
    isAuthenticated: true,
    isAuthLoading: false,
    user: authUser,
  }),
}));

vi.mock('@/lib/api/mySessions', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/mySessions')>(
    '@/lib/api/mySessions'
  );
  return {
    ...actual,
    fetchMySessions: (...args: unknown[]) => fetchMySessionsMock(...args),
    deleteIncompleteSession: (...args: unknown[]) =>
      deleteIncompleteSessionMock(...args),
  };
});

function entry(overrides: Partial<MySessionEntry> = {}): MySessionEntry {
  return {
    participantId: '11111111-1111-4111-8111-111111111111',
    nickname: 'Justin',
    joinedAt: '2026-08-22T12:00:00.000Z',
    role: 'host',
    sessionId: '22222222-2222-4222-8222-222222222222',
    createdAt: '2026-08-22T12:00:00.000Z',
    durationMinutes: 5,
    workout: [{ name: 'Mountain Climbers', target: 20, unit: 'reps' }],
    state: 'waiting',
    segmentIndex: 0,
    roundCount: 0,
    partialReps: 0,
    finalScore: null,
    scoreBreakdown: null,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  fetchMySessionsMock.mockReset();
  deleteIncompleteSessionMock.mockReset();
  vi.unstubAllGlobals();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <MySessionsPage />
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe('MySessionsPage delete', () => {
  it('shows Delete only for incomplete host rows', async () => {
    fetchMySessionsMock.mockResolvedValue({
      data: [
        entry({ participantId: 'p1', sessionId: 's1' }),
        entry({
          participantId: 'p2',
          sessionId: 's2',
          role: 'joiner',
        }),
        entry({
          participantId: 'p3',
          sessionId: 's3',
          state: 'finished',
          finalScore: 100,
          scoreBreakdown: {
            baseScore: 100,
            pvi: null,
            pviMultiplier: 1,
            domainWeight: 1,
            finalScore: 100,
          },
        }),
      ],
      error: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('View session')).toHaveLength(3);
    });

    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'View breakdown' })).toBeTruthy();
  });

  it('confirms then deletes and removes the row', async () => {
    fetchMySessionsMock.mockResolvedValue({
      data: [entry()],
      error: null,
    });
    deleteIncompleteSessionMock.mockImplementation(async () => ({ error: null }));
    const confirmMock = vi.fn(() => true);
    vi.stubGlobal('confirm', confirmMock);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(confirmMock).toHaveBeenCalled();

    await waitFor(() => {
      expect(deleteIncompleteSessionMock).toHaveBeenCalledWith(
        '22222222-2222-4222-8222-222222222222'
      );
      expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
      expect(
        screen.getByText(/No saved sessions yet/)
      ).toBeTruthy();
    });
  });
});
