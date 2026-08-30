import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useLobbyForceNav } from './useLobbyForceNav';

const navigateMock = vi.fn();
const joinLobbyMock = vi.fn();
const getLobbyMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/lib/api/lobby', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/lobby')>('@/lib/api/lobby');
  return {
    ...actual,
    joinLobby: (...args: unknown[]) => joinLobbyMock(...args),
    getLobby: (...args: unknown[]) => getLobbyMock(...args),
  };
});

vi.mock('@/lib/lobbyIdentity', () => ({
  getStoredLobbyNickname: () => 'Jules',
}));

vi.mock('@/lib/sessionIdentity', () => ({
  getStoredNickname: () => null,
}));

const LOBBY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SESSION_A = '11111111-1111-4111-8111-111111111111';
const SESSION_B = '22222222-2222-4222-8222-222222222222';

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('useLobbyForceNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    joinLobbyMock.mockResolvedValue({
      data: {
        lobbyId: LOBBY_ID,
        lobbyMemberId: 'm1',
        sessionId: SESSION_B,
        sessionState: 'waiting',
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips finished active sessions', async () => {
    renderHook(
      () =>
        useLobbyForceNav({
          lobbyId: LOBBY_ID,
          activeSessionId: SESSION_B,
          activeSessionState: 'finished',
          currentSessionId: SESSION_A,
          enabled: true,
        }),
      { wrapper }
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(joinLobbyMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('joins and navigates when the next session is waiting', async () => {
    renderHook(
      () =>
        useLobbyForceNav({
          lobbyId: LOBBY_ID,
          activeSessionId: SESSION_B,
          activeSessionState: 'waiting',
          currentSessionId: SESSION_A,
          enabled: true,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(joinLobbyMock).toHaveBeenCalledWith({
        lobbyId: LOBBY_ID,
        nickname: 'Jules',
      });
      expect(navigateMock).toHaveBeenCalledWith(`/session/${SESSION_B}`, { replace: true });
    });
  });

  it('surfaces join errors and does not lock the navigated ref', async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    joinLobbyMock.mockResolvedValue({
      data: null,
      error: { message: 'Staging area is full.' },
    });

    renderHook(
      () =>
        useLobbyForceNav({
          lobbyId: LOBBY_ID,
          activeSessionId: SESSION_B,
          activeSessionState: 'waiting',
          currentSessionId: SESSION_A,
          enabled: true,
          onError,
        }),
      { wrapper }
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(onError).toHaveBeenCalledWith('Staging area is full.');
    expect(navigateMock).not.toHaveBeenCalled();

    joinLobbyMock.mockResolvedValue({
      data: { lobbyId: LOBBY_ID, lobbyMemberId: 'm1', sessionId: SESSION_B },
      error: null,
    });

    await act(async () => {
      vi.advanceTimersByTime(2_500);
      await Promise.resolve();
    });

    expect(joinLobbyMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(navigateMock).toHaveBeenCalledWith(`/session/${SESSION_B}`, { replace: true });
  });

  it('falls back to getLobby when session state is unknown', async () => {
    getLobbyMock.mockResolvedValue({
      data: {
        lobbyId: LOBBY_ID,
        activeSessionId: SESSION_B,
        activeSessionState: 'setup',
        hostUserId: 'u1',
        status: 'open',
        createdAt: '',
        updatedAt: '',
        members: [],
      },
      error: null,
    });

    renderHook(
      () =>
        useLobbyForceNav({
          lobbyId: LOBBY_ID,
          activeSessionId: SESSION_B,
          activeSessionState: null,
          currentSessionId: null,
          enabled: true,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(getLobbyMock).toHaveBeenCalledWith(LOBBY_ID);
      expect(navigateMock).toHaveBeenCalledWith(`/session/${SESSION_B}`, { replace: true });
    });
  });
});
