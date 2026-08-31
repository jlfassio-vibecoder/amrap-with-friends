import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { FORCE_NAV_DELAY_MS, useRallyPointForceNav } from './useRallyPointForceNav';

const navigateMock = vi.fn();
const joinRallyPointMock = vi.fn();
const getRallyPointMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/lib/api/rallyPoint', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/rallyPoint')>('@/lib/api/rallyPoint');
  return {
    ...actual,
    joinRallyPoint: (...args: unknown[]) => joinRallyPointMock(...args),
    getRallyPoint: (...args: unknown[]) => getRallyPointMock(...args),
  };
});

vi.mock('@/lib/rallyPointIdentity', () => ({
  getStoredRallyPointNickname: () => 'Jules',
}));

vi.mock('@/lib/missionIdentity', () => ({
  getStoredNickname: () => null,
}));

const RALLY_POINT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MISSION_A = '11111111-1111-4111-8111-111111111111';
const MISSION_B = '22222222-2222-4222-8222-222222222222';

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('useRallyPointForceNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    joinRallyPointMock.mockResolvedValue({
      data: {
        rallyPointId: RALLY_POINT_ID,
        rallyPointMemberId: 'm1',
        missionId: MISSION_B,
        missionState: 'waiting',
        participantId: 'p1',
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips finished active missions', async () => {
    renderHook(
      () =>
        useRallyPointForceNav({
          rallyPointId: RALLY_POINT_ID,
          activeMissionId: MISSION_B,
          activeMissionState: 'finished',
          currentMissionId: MISSION_A,
          enabled: true,
        }),
      { wrapper }
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(joinRallyPointMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('joins then navigates after the soft delay', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(
      () =>
        useRallyPointForceNav({
          rallyPointId: RALLY_POINT_ID,
          activeMissionId: MISSION_B,
          activeMissionState: 'waiting',
          currentMissionId: MISSION_A,
          enabled: true,
        }),
      { wrapper }
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(joinRallyPointMock).toHaveBeenCalledWith({
      rallyPointId: RALLY_POINT_ID,
      nickname: 'Jules',
    });
    expect(navigateMock).not.toHaveBeenCalled();
    expect(result.current.pendingMissionId).toBe(MISSION_B);

    await act(async () => {
      vi.advanceTimersByTime(FORCE_NAV_DELAY_MS);
    });

    expect(navigateMock).toHaveBeenCalledWith(`/mission/${MISSION_B}`, { replace: true });
    expect(result.current.pendingMissionId).toBeNull();
  });

  it('joinNow skips the remaining soft delay', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(
      () =>
        useRallyPointForceNav({
          rallyPointId: RALLY_POINT_ID,
          activeMissionId: MISSION_B,
          activeMissionState: 'waiting',
          currentMissionId: MISSION_A,
          enabled: true,
        }),
      { wrapper }
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.pendingMissionId).toBe(MISSION_B);

    await act(async () => {
      result.current.joinNow();
    });

    expect(navigateMock).toHaveBeenCalledWith(`/mission/${MISSION_B}`, { replace: true });
  });

  it('does not start soft-nav when enabled is false', async () => {
    renderHook(
      () =>
        useRallyPointForceNav({
          rallyPointId: RALLY_POINT_ID,
          activeMissionId: MISSION_B,
          activeMissionState: 'waiting',
          currentMissionId: MISSION_A,
          enabled: false,
        }),
      { wrapper }
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(joinRallyPointMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('surfaces join errors and does not lock the navigated ref', async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    joinRallyPointMock.mockResolvedValue({
      data: null,
      error: { message: 'Rally point is full.' },
    });

    renderHook(
      () =>
        useRallyPointForceNav({
          rallyPointId: RALLY_POINT_ID,
          activeMissionId: MISSION_B,
          activeMissionState: 'waiting',
          currentMissionId: MISSION_A,
          enabled: true,
          onError,
        }),
      { wrapper }
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(onError).toHaveBeenCalledWith('Rally point is full.');
    expect(navigateMock).not.toHaveBeenCalled();

    joinRallyPointMock.mockResolvedValue({
      data: {
        rallyPointId: RALLY_POINT_ID,
        rallyPointMemberId: 'm1',
        missionId: MISSION_B,
        participantId: 'p1',
      },
      error: null,
    });

    await act(async () => {
      vi.advanceTimersByTime(2_500);
      await Promise.resolve();
    });

    expect(joinRallyPointMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(navigateMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(FORCE_NAV_DELAY_MS);
    });

    expect(navigateMock).toHaveBeenCalledWith(`/mission/${MISSION_B}`, { replace: true });
  });

  it('does not navigate when join succeeds without a participant seat', async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    joinRallyPointMock.mockResolvedValue({
      data: {
        rallyPointId: RALLY_POINT_ID,
        rallyPointMemberId: 'm1',
        missionId: MISSION_B,
        missionState: 'waiting',
        participantId: null,
      },
      error: null,
    });

    renderHook(
      () =>
        useRallyPointForceNav({
          rallyPointId: RALLY_POINT_ID,
          activeMissionId: MISSION_B,
          activeMissionState: 'waiting',
          currentMissionId: MISSION_A,
          enabled: true,
          onError,
        }),
      { wrapper }
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(onError).toHaveBeenCalledWith('Could not join the next mission. Try again.');
    expect(navigateMock).not.toHaveBeenCalled();

    joinRallyPointMock.mockResolvedValue({
      data: {
        rallyPointId: RALLY_POINT_ID,
        rallyPointMemberId: 'm1',
        missionId: MISSION_B,
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

    expect(navigateMock).toHaveBeenCalledWith(`/mission/${MISSION_B}`, { replace: true });
  });

  it('falls back to getRallyPoint when mission state is unknown', async () => {
    vi.useFakeTimers();
    getRallyPointMock.mockResolvedValue({
      data: {
        rallyPointId: RALLY_POINT_ID,
        activeMissionId: MISSION_B,
        activeMissionState: 'setup',
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
        useRallyPointForceNav({
          rallyPointId: RALLY_POINT_ID,
          activeMissionId: MISSION_B,
          activeMissionState: null,
          currentMissionId: null,
          enabled: true,
        }),
      { wrapper }
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(getRallyPointMock).toHaveBeenCalledWith(RALLY_POINT_ID);
    expect(result.current.pendingMissionId).toBe(MISSION_B);

    await act(async () => {
      vi.advanceTimersByTime(FORCE_NAV_DELAY_MS);
    });

    expect(navigateMock).toHaveBeenCalledWith(`/mission/${MISSION_B}`, { replace: true });
  });
});
