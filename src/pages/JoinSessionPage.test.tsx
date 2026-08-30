import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import JoinSessionPage from './JoinSessionPage';
import { SESSION_LOCKED_OR_INVALID, SESSION_RALLY_DEPARTED } from '@/lib/api/sessions';

const joinSessionMock = vi.fn();
const joinLobbyMock = vi.fn();
const resumeSessionIdentityMock = vi.fn();
const authState = vi.hoisted(() => ({
  isAuthenticated: false,
  isAuthLoading: false,
  user: null as { id: string; email?: string } | null,
}));

vi.mock('@/lib/api/sessions', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/sessions')>('@/lib/api/sessions');
  return {
    ...actual,
    joinSession: (...args: unknown[]) => joinSessionMock(...args),
  };
});

vi.mock('@/lib/api/lobby', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/lobby')>('@/lib/api/lobby');
  return {
    ...actual,
    joinLobby: (...args: unknown[]) => joinLobbyMock(...args),
  };
});

vi.mock('@/lib/api/resumeSessionIdentity', () => ({
  resumeSessionIdentity: (...args: unknown[]) => resumeSessionIdentityMock(...args),
}));

vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: () => ({
    isAuthenticated: authState.isAuthenticated,
    isAuthLoading: authState.isAuthLoading,
    user: authState.user,
  }),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseConfigError: () => null,
}));

vi.mock('@/lib/api/hostScheduledSessions', () => ({
  fetchHostScheduledSessions: vi.fn().mockResolvedValue({ data: [], error: null }),
  formatHostScheduledSessionWorkout: (workout: { name: string }[]) => workout[0]?.name ?? 'Workout',
  formatHostScheduledSessionRallyTime: () => 'Rally time',
  formatHostScheduledSessionState: (state: string) => state,
}));

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const LOBBY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

afterEach(() => {
  cleanup();
  joinSessionMock.mockReset();
  joinLobbyMock.mockReset();
  resumeSessionIdentityMock.mockReset();
  authState.isAuthenticated = false;
  authState.isAuthLoading = false;
  authState.user = null;
});

function renderJoin(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <Routes>
          <Route path="/join" element={<JoinSessionPage />} />
          <Route path="/session/:sessionId" element={<p>In lobby</p>} />
          <Route path="/lobby/:lobbyId" element={<p>In staging</p>} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe('JoinSessionPage deep link', () => {
  it('hides Session ID and shows the name field for guests', () => {
    renderJoin(`/join?s=${SESSION_ID}`);
    expect(screen.queryByLabelText(/Session ID/i)).toBeNull();
    expect(screen.getByLabelText(/Your name/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Join session/i })).toBeTruthy();
  });

  it('joins as guest with a name from the join form', async () => {
    joinSessionMock.mockResolvedValue({
      data: { participantId: 'p1', claimToken: 'c1' },
      error: null,
    });
    renderJoin(`/join?s=${SESSION_ID}`);

    fireEvent.change(screen.getByLabelText(/Your name/i), {
      target: { value: 'Ghost' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Join session/i }));

    await waitFor(() => {
      expect(joinSessionMock).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        nickname: 'Ghost',
      });
    });
    expect(await screen.findByText('In lobby')).toBeTruthy();
  });

  it('auto-joins authenticated users with email local-part', async () => {
    authState.isAuthenticated = true;
    authState.user = { id: 'user-1', email: 'operator@example.com' };
    resumeSessionIdentityMock.mockResolvedValue({
      data: null,
      missing: true,
      error: null,
    });
    joinSessionMock.mockResolvedValue({
      data: {
        participantId: 'p1',
        claimToken: 'c1',
        hostToken: null,
        nickname: 'operator',
        role: 'joiner',
      },
      error: null,
    });

    renderJoin(`/join?s=${SESSION_ID}`);

    expect(screen.getByText(/Welcome, operator/i)).toBeTruthy();
    await waitFor(() => {
      expect(resumeSessionIdentityMock).toHaveBeenCalledWith(SESSION_ID);
      expect(joinSessionMock).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        nickname: 'operator',
      });
    });
    expect(await screen.findByText('In lobby')).toBeTruthy();
  });

  it('reclaims host via resume before join for authenticated users', async () => {
    authState.isAuthenticated = true;
    authState.user = { id: 'user-1', email: 'coach@example.com' };
    resumeSessionIdentityMock.mockResolvedValue({
      data: {
        participantId: 'host-1',
        nickname: 'Coach',
        role: 'host',
        hostToken: 'host-secret',
      },
      missing: false,
      error: null,
    });

    renderJoin(`/join?s=${SESSION_ID}`);

    await waitFor(() => {
      expect(resumeSessionIdentityMock).toHaveBeenCalledWith(SESSION_ID);
    });
    expect(joinSessionMock).not.toHaveBeenCalled();
    expect(await screen.findByText('In lobby')).toBeTruthy();
  });

  it('shows LOCKED OR INVALID for a bad s param', () => {
    renderJoin('/join?s=not-a-uuid');
    expect(screen.getByText(SESSION_LOCKED_OR_INVALID)).toBeTruthy();
    expect(screen.queryByLabelText(/Your name/i)).toBeNull();
  });

  it('surfaces departed copy when joinSession reports Session locked', async () => {
    joinSessionMock.mockResolvedValue({
      data: null,
      error: { message: SESSION_RALLY_DEPARTED },
    });
    renderJoin(`/join?s=${SESSION_ID}`);

    fireEvent.change(screen.getByLabelText(/Your name/i), {
      target: { value: 'Late' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Join session/i }));

    expect(await screen.findByText(SESSION_RALLY_DEPARTED)).toBeTruthy();
  });

  it('routes ?l= to staging when the active session is finished', async () => {
    joinLobbyMock.mockResolvedValue({
      data: {
        lobbyId: LOBBY_ID,
        lobbyMemberId: 'm1',
        sessionId: SESSION_ID,
        sessionState: 'finished',
        participantId: 'p1',
        claimToken: null,
        hostToken: null,
      },
      error: null,
    });
    renderJoin(`/join?l=${LOBBY_ID}`);

    fireEvent.change(screen.getByLabelText(/Your name/i), {
      target: { value: 'Jules' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Join session/i }));

    await waitFor(() => {
      expect(joinLobbyMock).toHaveBeenCalledWith({
        lobbyId: LOBBY_ID,
        nickname: 'Jules',
      });
    });
    expect(await screen.findByText('In staging')).toBeTruthy();
  });

  it('routes ?l= to the session when the active session is live', async () => {
    joinLobbyMock.mockResolvedValue({
      data: {
        lobbyId: LOBBY_ID,
        lobbyMemberId: 'm1',
        sessionId: SESSION_ID,
        sessionState: 'waiting',
        participantId: 'p1',
        claimToken: 'c1',
        hostToken: null,
      },
      error: null,
    });
    renderJoin(`/join?l=${LOBBY_ID}`);

    fireEvent.change(screen.getByLabelText(/Your name/i), {
      target: { value: 'Jules' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Join session/i }));

    expect(await screen.findByText('In lobby')).toBeTruthy();
  });
});
