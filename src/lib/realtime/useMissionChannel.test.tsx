import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { GUEST_MISSION_POLL_MS, useMissionChannel } from './useMissionChannel';
import { LIVE_RECONCILE_MS } from './liveReconcile';

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
    // clearAllMocks does not drain mockResolvedValueOnce queues; an unconsumed
    // one would surface in whichever test ran next.
    getMissionLiveStateMock.mockReset();
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
        snapshotAt: '2026-09-03T00:00:00.000Z',
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

  it('pulls a full snapshot on a timer while the mission is live', async () => {
    // Nothing else repairs another athlete's dropped rounds INSERT: only the
    // athlete who logged it hears from log_round that the index moved, and the
    // incremental watermark is already past the row.
    vi.useFakeTimers();
    getMissionLiveStateMock.mockResolvedValue({
      ok: true,
      data: {
        mission: {
          id: MISSION_ID,
          state: 'work',
          time_left_sec: 300,
          is_paused: false,
          started_at: '2026-09-03T00:00:00.000Z',
          segment_index: 0,
          duration_minutes: 5,
          workout: [],
          template_id: null,
          scheduled_at: null,
          rally_point_countdown_ends_at: null,
          created_at: '2026-09-03T00:00:00.000Z',
          is_featured: false,
          rally_point_id: null,
        },
        missionClock: null,
        participants: [],
        participantIds: null,
        rounds: [],
        messages: [],
        segmentResults: [],
        incremental: false,
        snapshotAt: '2026-09-03T00:00:00.000Z',
      },
    });

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
    expect(getMissionLiveStateMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(LIVE_RECONCILE_MS);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getMissionLiveStateMock).toHaveBeenCalledTimes(2);
    // Full, not incremental: "everything since" would never name the row that
    // went missing.
    expect(getMissionLiveStateMock.mock.calls[1]![0]).toMatchObject({ since: null });
  });

  it('keeps a round that arrived live while the reconcile snapshot was in flight', async () => {
    // The server ran its query before the response landed, so a round that
    // arrived in between is newer than the snapshot. Replacing would throw away
    // exactly the kind of row this fetch exists to recover -- and near the end
    // of a mission the reconcile timer stops before it could be pulled again.
    const liveRound = {
      id: 'cccc1111-1111-4111-8111-111111111111',
      mission_id: MISSION_ID,
      participant_id: 'participant-2',
      round_index: 0,
      elapsed_sec_at_round: 41,
      segment_index: 0,
      missed_log_reps: null,
      created_at: '2026-09-03T00:00:41.000Z',
    };

    const { result } = renderHook(() =>
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

    const roundsHandler = channelMocks[0]!.on.mock.calls.find(
      (call) => call[0] === 'postgres_changes' && (call[1] as { table?: string }).table === 'rounds'
    )![2] as (payload: { new: Record<string, unknown> }) => void;

    // Live INSERT arrives, then a full snapshot that predates it resolves.
    await act(async () => {
      roundsHandler({ new: liveRound });
    });
    expect(result.current.rounds).toHaveLength(1);

    await act(async () => {
      result.current.resync();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.rounds.map((row) => row.id)).toEqual([liveRound.id]);
  });

  it('does not reconcile once the mission is no longer running', async () => {
    vi.useFakeTimers();
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
    expect(getMissionLiveStateMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(LIVE_RECONCILE_MS * 3);
      await Promise.resolve();
    });

    expect(getMissionLiveStateMock).toHaveBeenCalledTimes(1);
  });

  it('pulls one last full snapshot as the mission stops running', async () => {
    // The reconcile timer stops with the clock, so anything dropped inside the
    // final interval -- the rounds that decide the score -- would otherwise
    // stay missing for good.
    function snapshot(state: string) {
      return {
        ok: true,
        data: {
          mission: {
            id: MISSION_ID,
            state,
            time_left_sec: state === 'finished' ? 0 : 10,
            is_paused: false,
            started_at: '2026-09-03T00:00:00.000Z',
            segment_index: 0,
            duration_minutes: 5,
            workout: [],
            template_id: null,
            scheduled_at: null,
            rally_point_countdown_ends_at: null,
            created_at: '2026-09-03T00:00:00.000Z',
            is_featured: false,
            rally_point_id: null,
          },
          missionClock: null,
          participants: [],
          participantIds: null,
          rounds: [],
          messages: [],
          segmentResults: [],
          incremental: false,
          snapshotAt: '2026-09-03T00:00:00.000Z',
        },
      };
    }

    getMissionLiveStateMock.mockResolvedValueOnce(snapshot('work'));
    getMissionLiveStateMock.mockResolvedValue(snapshot('finished'));

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
    expect(getMissionLiveStateMock).toHaveBeenCalledTimes(1);

    const missionHandler = channelMocks[0]!.on.mock.calls.find(
      (call) =>
        call[0] === 'postgres_changes' && (call[1] as { table?: string }).table === 'missions'
    )![2] as (payload: { new: Record<string, unknown> }) => void;

    await act(async () => {
      missionHandler({ new: snapshot('finished').data.mission });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getMissionLiveStateMock).toHaveBeenCalledTimes(2);
  });

  it('abandons an in-flight incremental when resync starts a full snapshot', async () => {
    // resync exists because a client can be short a rounds INSERT it never
    // received. If an incremental request issued a moment earlier is still
    // running, it can land after the full snapshot, overwrite what that
    // snapshot just repaired and push the watermark forward again -- putting
    // the hole straight back. fetchGenRef is the guard for exactly that, and
    // resync used to walk past it.
    vi.useFakeTimers();
    const snapshot = (rounds: { id: string }[], incremental: boolean, at: string) => ({
      ok: true,
      data: {
        mission: null,
        missionClock: null,
        participants: [],
        participantIds: null,
        rounds: rounds.map((row) => ({
          id: row.id,
          mission_id: MISSION_ID,
          participant_id: 'participant-1',
          round_index: 0,
          elapsed_sec_at_round: 10,
          segment_index: 0,
          missed_log_reps: null,
          created_at: at,
        })),
        messages: [],
        segmentResults: [],
        incremental,
        snapshotAt: at,
      },
    });

    getMissionLiveStateMock.mockResolvedValueOnce(snapshot([], false, '2026-09-03T00:00:00.000Z'));
    const { result } = renderHook(() =>
      useMissionChannel(
        MISSION_ID,
        { participantId: 'participant-1', nickname: 'Guest' },
        { realtimeTables: false }
      )
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // The poll issues a request that will not settle yet: this is the one that
    // must lose.
    let releaseStale: (() => void) | null = null;
    getMissionLiveStateMock.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseStale = () => resolve(snapshot([{ id: 'stale' }], true, '2026-09-03T00:09:00.000Z'));
      })
    );
    await act(async () => {
      vi.advanceTimersByTime(GUEST_MISSION_POLL_MS);
      await Promise.resolve();
    });
    expect(getMissionLiveStateMock).toHaveBeenCalledTimes(2);

    // Now the resync, which settles first and carries the repaired truth.
    getMissionLiveStateMock.mockResolvedValueOnce(
      snapshot([{ id: 'repaired' }], false, '2026-09-03T00:00:02.000Z')
    );
    await act(async () => {
      result.current.resync();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.rounds.map((row) => row.id)).toEqual(['repaired']);

    // The abandoned request lands last and must change nothing.
    await act(async () => {
      releaseStale?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.rounds.map((row) => row.id)).toEqual(['repaired']);
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
          snapshotAt: '2026-09-03T00:00:00.000Z',
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
          snapshotAt: '2026-09-03T00:01:10.000Z',
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
