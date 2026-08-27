import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  channelMocks,
  removeChannelMock,
  channelFactory,
} = vi.hoisted(() => {
  const removeChannelMock = vi.fn();
  const channelMocks: Array<{
    on: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    track: ReturnType<typeof vi.fn>;
    untrack: ReturnType<typeof vi.fn>;
    presenceState: ReturnType<typeof vi.fn>;
    subscribeStatusHandler: ((status: string) => void) | null;
  }> = [];

  function channelFactory() {
    const mock = {
      on: vi.fn(),
      subscribe: vi.fn(),
      track: vi.fn(() => Promise.resolve()),
      untrack: vi.fn(() => Promise.resolve()),
      presenceState: vi.fn(() => ({})),
      subscribeStatusHandler: null as ((status: string) => void) | null,
    };
    mock.on.mockImplementation(() => mock);
    mock.subscribe.mockImplementation((handler?: (status: string) => void) => {
      mock.subscribeStatusHandler = handler ?? null;
      return mock;
    });
    channelMocks.push(mock);
    return mock;
  }

  return { channelMocks, removeChannelMock, channelFactory };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    channel: vi.fn(() => channelFactory()),
    removeChannel: removeChannelMock,
  },
}));

afterEach(() => {
  channelMocks.length = 0;
  removeChannelMock.mockClear();
  vi.resetModules();
});

describe('globalPresenceChannel singleton', () => {
  it('registers presence handlers before subscribe and ignores a second .on from listeners', async () => {
    const { subscribeOnlineUserIds, startGlobalPresenceBroadcast } =
      await import('./globalPresenceChannel');

    const stopBroadcast = startGlobalPresenceBroadcast('user-1');
    expect(channelMocks).toHaveLength(1);
    const first = channelMocks[0]!;
    expect(first.on).toHaveBeenCalledTimes(3);
    expect(first.subscribe).toHaveBeenCalledTimes(1);

    const listener = vi.fn();
    const stopListen = subscribeOnlineUserIds(listener);

    // Same channel — no second RealtimeChannel / no more .on calls
    expect(channelMocks).toHaveLength(1);
    expect(first.on).toHaveBeenCalledTimes(3);
    expect(listener).toHaveBeenCalled();

    first.subscribeStatusHandler?.('SUBSCRIBED');
    expect(first.track).toHaveBeenCalled();

    stopListen();
    stopBroadcast();
  });

  it('does not throw when the listener attaches after the channel is already subscribed', async () => {
    const { subscribeOnlineUserIds, startGlobalPresenceBroadcast } =
      await import('./globalPresenceChannel');

    startGlobalPresenceBroadcast('user-1');
    const first = channelMocks[0]!;
    first.subscribeStatusHandler?.('SUBSCRIBED');
    first.presenceState.mockReturnValue({ 'user-1': [{ online_at: 'now' }] });

    const listener = vi.fn();
    expect(() => subscribeOnlineUserIds(listener)).not.toThrow();
    expect(listener).toHaveBeenCalledWith(new Set(['user-1']));
    expect(channelMocks).toHaveLength(1);
    expect(first.on).toHaveBeenCalledTimes(3);
  });
});
