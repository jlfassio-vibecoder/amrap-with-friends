import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { GUEST_LOBBY_POLL_MS, useLobbyChannel } from './useLobbyChannel';

const { channelMocks, removeChannelMock, channelFactory, getLobbyMock } = vi.hoisted(() => {
  const removeChannelMock = vi.fn();
  const getLobbyMock = vi.fn();
  const channelMocks: Array<{
    on: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    track: ReturnType<typeof vi.fn>;
    presenceState: ReturnType<typeof vi.fn>;
  }> = [];

  function channelFactory() {
    const mock = {
      on: vi.fn(),
      subscribe: vi.fn(),
      track: vi.fn(() => Promise.resolve()),
      presenceState: vi.fn(() => ({})),
    };
    mock.on.mockImplementation(() => mock);
    mock.subscribe.mockImplementation(() => mock);
    channelMocks.push(mock);
    return mock;
  }

  return { channelMocks, removeChannelMock, channelFactory, getLobbyMock };
});

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    channel: vi.fn(() => channelFactory()),
    removeChannel: removeChannelMock,
  }),
}));

vi.mock('@/lib/api/lobby', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/lobby')>('@/lib/api/lobby');
  return {
    ...actual,
    getLobby: (...args: unknown[]) => getLobbyMock(...args),
  };
});

const LOBBY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('useLobbyChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channelMocks.length = 0;
    getLobbyMock.mockResolvedValue({
      data: {
        lobbyId: LOBBY_ID,
        hostUserId: 'user-1',
        activeSessionId: null,
        activeSessionState: null,
        status: 'open',
        createdAt: '',
        updatedAt: '',
        nextMissionPendingAt: null,
        members: [],
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('registers postgres_changes when realtimeTables is true', async () => {
    renderHook(() =>
      useLobbyChannel(LOBBY_ID, { memberId: 'm1', nickname: 'Host' }, { realtimeTables: true })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(channelMocks).toHaveLength(1);
    const channel = channelMocks[0]!;
    const postgresCalls = channel.on.mock.calls.filter((call) => call[0] === 'postgres_changes');
    expect(postgresCalls).toHaveLength(2);
    expect(postgresCalls[0]?.[1]).toMatchObject({
      table: 'lobbies',
      filter: `id=eq.${LOBBY_ID}`,
    });
    expect(postgresCalls[1]?.[1]).toMatchObject({
      table: 'lobby_members',
      filter: `lobby_id=eq.${LOBBY_ID}`,
    });
  });

  it('polls get_lobby and skips postgres_changes when realtimeTables is false', async () => {
    vi.useFakeTimers();
    renderHook(() =>
      useLobbyChannel(LOBBY_ID, { memberId: 'm1', nickname: 'Guest' }, { realtimeTables: false })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(getLobbyMock).toHaveBeenCalledTimes(1);
    expect(channelMocks).toHaveLength(1);
    const channel = channelMocks[0]!;
    const postgresCalls = channel.on.mock.calls.filter((call) => call[0] === 'postgres_changes');
    expect(postgresCalls).toHaveLength(0);
    expect(channel.on.mock.calls.some((call) => call[0] === 'presence')).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(GUEST_LOBBY_POLL_MS);
      await Promise.resolve();
    });

    expect(getLobbyMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
