import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';

const fetchCoachOnlineNowMock = vi.fn();
const subscribeOnlineAnonIdsMock = vi.fn();
const subscribeOnlineUserIdsMock = vi.fn();

vi.mock('@/lib/api/coach', () => ({
  fetchCoachOnlineNow: (...args: unknown[]) => fetchCoachOnlineNowMock(...args),
}));

vi.mock('@/lib/realtime/globalPresenceChannel', () => ({
  subscribeOnlineAnonIds: (...args: unknown[]) => subscribeOnlineAnonIdsMock(...args),
  subscribeOnlineUserIds: (...args: unknown[]) => subscribeOnlineUserIdsMock(...args),
}));

import {
  resetCoachOnlinePollForTests,
  useOnlineAnonIds,
  useOnlineUserIds,
} from '@/hooks/useOnlineUserIds';

const ANON_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('useOnlineUserIds / useOnlineAnonIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCoachOnlinePollForTests();
    fetchCoachOnlineNowMock.mockResolvedValue({
      data: { userIds: ['user-1'], anonIds: [ANON_UUID] },
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
    resetCoachOnlinePollForTests();
  });

  it('updates both sets from one shared coach_online_now poll', async () => {
    const users = renderHook(() => useOnlineUserIds());
    const anons = renderHook(() => useOnlineAnonIds());

    await waitFor(() => {
      expect(users.result.current.has('user-1')).toBe(true);
      expect(anons.result.current.has(ANON_UUID)).toBe(true);
    });

    expect(fetchCoachOnlineNowMock).toHaveBeenCalledTimes(1);
    expect(subscribeOnlineAnonIdsMock).not.toHaveBeenCalled();
    expect(subscribeOnlineUserIdsMock).not.toHaveBeenCalled();
  });

  it('leaves the sets empty when the RPC fails', async () => {
    fetchCoachOnlineNowMock.mockResolvedValue({
      data: null,
      error: { message: 'Not authorized' },
    });

    const users = renderHook(() => useOnlineUserIds());

    await waitFor(() => {
      expect(fetchCoachOnlineNowMock).toHaveBeenCalled();
    });

    expect(users.result.current.size).toBe(0);
    expect(subscribeOnlineAnonIdsMock).not.toHaveBeenCalled();
  });
});
