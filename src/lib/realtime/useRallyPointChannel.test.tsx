import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { GUEST_RALLY_POINT_POLL_MS, useRallyPointChannel } from './useRallyPointChannel';

const { channelMocks, removeChannelMock, channelFactory, getRallyPointMock } = vi.hoisted(() => {
  const removeChannelMock = vi.fn();
  const getRallyPointMock = vi.fn();
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

  return { channelMocks, removeChannelMock, channelFactory, getRallyPointMock };
});

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    channel: vi.fn(() => channelFactory()),
    removeChannel: removeChannelMock,
  }),
}));

vi.mock('@/lib/api/rallyPoint', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/rallyPoint')>('@/lib/api/rallyPoint');
  return {
    ...actual,
    getRallyPoint: (...args: unknown[]) => getRallyPointMock(...args),
  };
});

const RALLY_POINT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('useRallyPointChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channelMocks.length = 0;
    getRallyPointMock.mockResolvedValue({
      data: {
        rallyPointId: RALLY_POINT_ID,
        hostUserId: 'user-1',
        activeMissionId: null,
        activeMissionState: null,
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
      useRallyPointChannel(
        RALLY_POINT_ID,
        { memberId: 'm1', nickname: 'Host' },
        { realtimeTables: true }
      )
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(channelMocks).toHaveLength(1);
    const channel = channelMocks[0]!;
    const postgresCalls = channel.on.mock.calls.filter((call) => call[0] === 'postgres_changes');
    expect(postgresCalls).toHaveLength(2);
    expect(postgresCalls[0]?.[1]).toMatchObject({
      table: 'rallyPoints',
      filter: `id=eq.${RALLY_POINT_ID}`,
    });
    expect(postgresCalls[1]?.[1]).toMatchObject({
      table: 'rally_point_members',
      filter: `rally_point_id=eq.${RALLY_POINT_ID}`,
    });
  });

  it('polls get_rally_point and skips postgres_changes when realtimeTables is false', async () => {
    vi.useFakeTimers();
    renderHook(() =>
      useRallyPointChannel(
        RALLY_POINT_ID,
        { memberId: 'm1', nickname: 'Guest' },
        { realtimeTables: false }
      )
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(getRallyPointMock).toHaveBeenCalledTimes(1);
    expect(channelMocks).toHaveLength(1);
    const channel = channelMocks[0]!;
    const postgresCalls = channel.on.mock.calls.filter((call) => call[0] === 'postgres_changes');
    expect(postgresCalls).toHaveLength(0);
    expect(channel.on.mock.calls.some((call) => call[0] === 'presence')).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(GUEST_RALLY_POINT_POLL_MS);
      await Promise.resolve();
    });

    expect(getRallyPointMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
