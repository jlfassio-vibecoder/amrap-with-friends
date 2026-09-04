import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { GUEST_MISSION_POLL_MS, useMissionChannel } from './useMissionChannel';

const { channelMocks, removeChannelMock, channelFactory, fromMock, getMissionLiveStateMock } =
  vi.hoisted(() => {
    const removeChannelMock = vi.fn();
    const fromMock = vi.fn();
    const getMissionLiveStateMock = vi.fn();
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
      mock.subscribe.mockImplementation((cb?: (status: string) => void) => {
        if (typeof cb === 'function') {
          void Promise.resolve().then(() => cb('SUBSCRIBED'));
        }
        return mock;
      });
      channelMocks.push(mock);
      return mock;
    }

    return {
      channelMocks,
      removeChannelMock,
      channelFactory,
      fromMock,
      getMissionLiveStateMock,
    };
  });

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    from: fromMock,
    channel: vi.fn(() => channelFactory()),
    removeChannel: removeChannelMock,
  }),
}));

vi.mock('@/lib/analytics/track', () => ({
  track: vi.fn(),
}));

vi.mock('@/lib/api/getMissionLiveState', () => ({
  getMissionLiveState: (...args: unknown[]) => getMissionLiveStateMock(...args),
}));

vi.mock('@/lib/missionIdentity', () => ({
  getStoredClaimToken: () => 'claim-token',
  getStoredHostToken: () => null,
}));

const MISSION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('useMissionChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channelMocks.length = 0;
    getMissionLiveStateMock.mockResolvedValue({
      ok: true,
      data: {
        mission: null,
        missionClock: null,
        participants: [],
        participantIds: null,
        rounds: [],
        messages: [],
        segmentResults: [],
        incremental: false,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('bootstraps via get_mission_live_state and never opens table SELECT', async () => {
    renderHook(() =>
      useMissionChannel(MISSION_ID, {
        participantId: 'participant-1',
        nickname: 'Athlete',
      })
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getMissionLiveStateMock).toHaveBeenCalledWith({
      missionId: MISSION_ID,
      participantId: 'participant-1',
      claimToken: 'claim-token',
      hostToken: null,
      since: null,
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('polls live state and skips postgres_changes when realtimeTables is false', async () => {
    vi.useFakeTimers();
    renderHook(() =>
      useMissionChannel(
        MISSION_ID,
        { participantId: 'participant-1', nickname: 'Guest' },
        { realtimeTables: false }
      )
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(channelMocks).toHaveLength(1);
    const channel = channelMocks[0]!;
    const postgresCalls = channel.on.mock.calls.filter((call) => call[0] === 'postgres_changes');
    expect(postgresCalls).toHaveLength(0);
    expect(channel.on.mock.calls.some((call) => call[0] === 'presence')).toBe(true);
    expect(getMissionLiveStateMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(GUEST_MISSION_POLL_MS);
      await Promise.resolve();
    });

    expect(getMissionLiveStateMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('merges incremental clock fields and prunes roster by participant_ids', async () => {
    vi.useFakeTimers();
    const bootstrapMission = {
      id: MISSION_ID,
      duration_minutes: 15,
      workout: [{ name: 'Burpees', target: 10, unit: 'reps' }],
      template_id: null,
      state: 'waiting',
      time_left_sec: 10,
      is_paused: false,
      started_at: null,
      scheduled_at: null,
      rally_point_countdown_ends_at: null,
      segment_index: 0,
      created_at: '2026-09-03T00:00:00.000Z',
      is_featured: false,
      rally_point_id: null,
    };

    getMissionLiveStateMock
      .mockResolvedValueOnce({
        ok: true,
        data: {
          mission: bootstrapMission,
          missionClock: null,
          participants: [
            {
              id: 'participant-1',
              mission_id: MISSION_ID,
              nickname: 'Host',
              role: 'host',
              joined_at: '2026-09-03T00:00:00.000Z',
            },
            {
              id: 'participant-leave',
              mission_id: MISSION_ID,
              nickname: 'Gone',
              role: 'joiner',
              joined_at: '2026-09-03T00:00:01.000Z',
            },
          ],
          participantIds: null,
          rounds: [],
          messages: [],
          segmentResults: [],
          incremental: false,
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          mission: null,
          missionClock: {
            id: MISSION_ID,
            duration_minutes: 15,
            template_id: null,
            state: 'work',
            time_left_sec: 880,
            is_paused: false,
            started_at: '2026-09-03T00:01:00.000Z',
            scheduled_at: null,
            rally_point_countdown_ends_at: null,
            segment_index: 0,
            created_at: '2026-09-03T00:00:00.000Z',
            is_featured: false,
            rally_point_id: null,
          },
          participants: [
            {
              id: 'participant-2',
              mission_id: MISSION_ID,
              nickname: 'New',
              role: 'joiner',
              joined_at: '2026-09-03T00:01:05.000Z',
            },
          ],
          participantIds: ['participant-1', 'participant-2'],
          rounds: [],
          messages: [],
          segmentResults: [],
          incremental: true,
        },
      });

    const { result } = renderHook(() =>
      useMissionChannel(
        MISSION_ID,
        { participantId: 'participant-1', nickname: 'Host' },
        { realtimeTables: false }
      )
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.mission?.workout).toEqual(bootstrapMission.workout);
    expect(result.current.participants.map((p) => p.id).sort()).toEqual([
      'participant-1',
      'participant-leave',
    ]);

    await act(async () => {
      vi.advanceTimersByTime(GUEST_MISSION_POLL_MS);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.mission?.state).toBe('work');
    expect(result.current.mission?.time_left_sec).toBe(880);
    expect(result.current.mission?.workout).toEqual(bootstrapMission.workout);
    expect(result.current.participants.map((p) => p.id).sort()).toEqual([
      'participant-1',
      'participant-2',
    ]);
  });

  it('registers mission_id-filtered segment-results listener when realtimeTables is true', async () => {
    renderHook(() =>
      useMissionChannel(
        MISSION_ID,
        { participantId: 'participant-1', nickname: 'Athlete' },
        { realtimeTables: true }
      )
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(channelMocks).toHaveLength(1);
    const channel = channelMocks[0]!;
    const postgresCalls = channel.on.mock.calls.filter((call) => call[0] === 'postgres_changes');
    const segmentCalls = postgresCalls.filter(
      (call) => (call[1] as { table?: string }).table === 'participant_segment_results'
    );

    expect(segmentCalls).toHaveLength(1);
    expect(segmentCalls[0]?.[1]).toMatchObject({
      table: 'participant_segment_results',
      filter: `mission_id=eq.${MISSION_ID}`,
    });

    for (const call of segmentCalls) {
      const filter = (call[1] as { filter?: string }).filter;
      expect(typeof filter).toBe('string');
      expect(filter?.length).toBeGreaterThan(0);
    }
  });
});
