import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { FORCE_NAV_DELAY_MS, useLobbyForceNav } from './useLobbyForceNav';

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
        participantId: 'p1',
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

  it('joins then navigates after the soft delay', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(
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

    await act(async () => {
      await Promise.resolve();
    });

    expect(joinLobbyMock).toHaveBeenCalledWith({
      lobbyId: LOBBY_ID,
      nickname: 'Jules',
    });
    expect(navigateMock).not.toHaveBeenCalled();
    expect(result.current.pendingSessionId).toBe(SESSION_B);

    await act(async () => {
      vi.advanceTimersByTime(FORCE_NAV_DELAY_MS);
    });

    expect(navigateMock).toHaveBeenCalledWith(`/session/${SESSION_B}`, { replace: true });
    expect(result.current.pendingSessionId).toBeNull();
  });

  it('joinNow skips the remaining soft delay', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(
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

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.pendingSessionId).toBe(SESSION_B);

    await act(async () => {
      result.current.joinNow();
    });

    expect(navigateMock).toHaveBeenCalledWith(`/session/${SESSION_B}`, { replace: true });
  });

  it('does not start soft-nav when enabled is false', async () => {
    renderHook(
      () =>
        useLobbyForceNav({
          lobbyId: LOBBY_ID,
          activeSessionId: SESSION_B,
          activeSessionState: 'waiting',
          currentSessionId: SESSION_A,
          enabled: false,
        }),
      { wrapper }
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(joinLobbyMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
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
      data: {
        lobbyId: LOBBY_ID,
        lobbyMemberId: 'm1',
        sessionId: SESSION_B,
        participantId: 'p1',
      },
      error: null,
    });

    await act(async () => {
      vi.advanceTimersByTime(2_500);
      await Promise.resolve();
    });

    expect(joinLobbyMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(navigateMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(FORCE_NAV_DELAY_MS);
    });

    expect(navigateMock).toHaveBeenCalledWith(`/session/${SESSION_B}`, { replace: true });
  });

  it('does not navigate when join succeeds without a participant seat', async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    joinLobbyMock.mockResolvedValue({
      data: {
        lobbyId: LOBBY_ID,
        lobbyMemberId: 'm1',
        sessionId: SESSION_B,
        sessionState: 'waiting',
        participantId: null,
      },
      error: null,
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

    expect(onError).toHaveBeenCalledWith('Could not join the next session. Try again.');
    expect(navigateMock).not.toHaveBeenCalled();

    joinLobbyMock.mockResolvedValue({
      data: {
        lobbyId: LOBBY_ID,
        lobbyMemberId: 'm1',
        sessionId: SESSION_B,
        participantId: 'p1',
      },
      error: null,
    });

    await act(async () => {
      vi.advanceTimersByTime(2_500);
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(FORCE_NAV_DELAY_MS);
    });

    expect(navigateMock).toHaveBeenCalledWith(`/session/${SESSION_B}`, { replace: true });
  });

  it('falls back to getLobby when session state is unknown', async () => {
    vi.useFakeTimers();
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
        nextMissionPendingAt: null,
      },
      error: null,
    });

    const { result } = renderHook(
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

    await act(async () => {
      await Promise.resolve();
    });

    expect(getLobbyMock).toHaveBeenCalledWith(LOBBY_ID);
    expect(result.current.pendingSessionId).toBe(SESSION_B);

    await act(async () => {
      vi.advanceTimersByTime(FORCE_NAV_DELAY_MS);
    });

    expect(navigateMock).toHaveBeenCalledWith(`/session/${SESSION_B}`, { replace: true });
  });
});
