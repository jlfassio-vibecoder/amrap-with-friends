import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useStaleRallyPointHostClaim } from './useStaleRallyPointHostClaim';

const claimMock = vi.fn();

vi.mock('@/lib/api/rallyPoint', () => ({
  claimRallyPointCommandIfStale: (...args: unknown[]) => claimMock(...args),
}));

const RALLY_POINT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('useStaleRallyPointHostClaim', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    claimMock.mockResolvedValue({
      data: {
        claimed: false,
        hostUserId: 'host-1',
        hostToken: null,
        activeSessionId: null,
        reason: 'host_present',
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('attempts immediately and on interval without resetting when presence map identity changes', async () => {
    const { rerender } = renderHook(
      (props: { presence: Record<string, { nickname: string }> }) =>
        useStaleRallyPointHostClaim({
          rallyPointId: RALLY_POINT_ID,
          hostUserId: 'host-1',
          userId: 'user-2',
          hostMemberId: 'member-host',
          presenceByMemberId: props.presence,
          enabled: true,
          intervalMs: 20_000,
        }),
      { initialProps: { presence: { 'member-host': { nickname: 'Host' } } } }
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(claimMock).toHaveBeenCalledTimes(1);

    // Heartbeat-style presence object churn should not reset the interval.
    rerender({ presence: { 'member-host': { nickname: 'Host' } } });
    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });
    expect(claimMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });
    expect(claimMock).toHaveBeenCalledTimes(2);
  });

  it('invokes onClaimed when the RPC reports claimed', async () => {
    const onClaimed = vi.fn();
    claimMock.mockResolvedValue({
      data: {
        claimed: true,
        hostUserId: 'user-2',
        hostToken: null,
        activeSessionId: null,
        reason: null,
      },
      error: null,
    });

    renderHook(() =>
      useStaleRallyPointHostClaim({
        rallyPointId: RALLY_POINT_ID,
        hostUserId: 'host-1',
        userId: 'user-2',
        enabled: true,
        onClaimed,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(onClaimed).toHaveBeenCalledWith(
      expect.objectContaining({ claimed: true, hostUserId: 'user-2' })
    );
  });

  it('does not poll when the viewer is already host', async () => {
    renderHook(() =>
      useStaleRallyPointHostClaim({
        rallyPointId: RALLY_POINT_ID,
        hostUserId: 'user-2',
        userId: 'user-2',
        enabled: true,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(claimMock).not.toHaveBeenCalled();
  });
});
