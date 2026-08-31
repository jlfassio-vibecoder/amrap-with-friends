import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMissionChannel } from './useMissionChannel';

type QueryResult = { data: unknown; error: null };

const {
  channelMocks,
  removeChannelMock,
  channelFactory,
  fromMock,
  eqCallsByTable,
  inCallsByTable,
} = vi.hoisted(() => {
  const removeChannelMock = vi.fn();
  const channelMocks: Array<{
    on: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    track: ReturnType<typeof vi.fn>;
    presenceState: ReturnType<typeof vi.fn>;
  }> = [];
  const eqCallsByTable: Record<string, Array<[string, unknown]>> = {};
  const inCallsByTable: Record<string, Array<[string, unknown]>> = {};

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

  function createQueryBuilder(table: string) {
    const result: QueryResult = { data: table === 'missions' ? null : [], error: null };
    const builder: Record<string, unknown> = {};
    const thenable = {
      then(
        onFulfilled?: (value: QueryResult) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) {
        return Promise.resolve(result).then(onFulfilled, onRejected);
      },
    };

    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn((column: string, value: unknown) => {
      if (!eqCallsByTable[table]) {
        eqCallsByTable[table] = [];
      }
      eqCallsByTable[table].push([column, value]);
      return Object.assign(builder, thenable);
    });
    builder.in = vi.fn((column: string, value: unknown) => {
      if (!inCallsByTable[table]) {
        inCallsByTable[table] = [];
      }
      inCallsByTable[table].push([column, value]);
      return Object.assign(builder, thenable);
    });
    builder.order = vi.fn(() => Object.assign(builder, thenable));
    builder.maybeSingle = vi.fn(() => Promise.resolve(result));
    Object.assign(builder, thenable);
    return builder;
  }

  const fromMock = vi.fn((table: string) => createQueryBuilder(table));

  return {
    channelMocks,
    removeChannelMock,
    channelFactory,
    fromMock,
    eqCallsByTable,
    inCallsByTable,
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

const MISSION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('useMissionChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channelMocks.length = 0;
    for (const key of Object.keys(eqCallsByTable)) {
      delete eqCallsByTable[key];
    }
    for (const key of Object.keys(inCallsByTable)) {
      delete inCallsByTable[key];
    }
  });

  it('registers a mission_id-filtered participant_segment_results listener', async () => {
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

  it('bootstraps participant_segment_results by mission_id, not participant_id in()', async () => {
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

    expect(fromMock).toHaveBeenCalledWith('participant_segment_results');
    expect(eqCallsByTable.participant_segment_results).toEqual(
      expect.arrayContaining([['mission_id', MISSION_ID]])
    );
    expect(inCallsByTable.participant_segment_results ?? []).toHaveLength(0);
  });
});
