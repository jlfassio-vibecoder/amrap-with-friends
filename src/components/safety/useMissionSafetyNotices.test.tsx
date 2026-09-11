import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { MISSION_SAFETY_NOTICES } from './missionSafetyNotices';
import { resetMissionSafetyPrefs } from './missionSafetyPrefs';
import { useMissionSafetyNotices } from './useMissionSafetyNotices';

afterEach(() => {
  resetMissionSafetyPrefs();
});

describe('useMissionSafetyNotices', () => {
  it('starts with the first notice incomplete', () => {
    const { result } = renderHook(() => useMissionSafetyNotices('mission-a'));

    expect(result.current.safetyNoticesComplete).toBe(false);
    expect(result.current.activeNotice?.id).toBe(MISSION_SAFETY_NOTICES[0]?.id);
  });

  it('advances through notices and completes after both confirms', () => {
    const { result } = renderHook(() => useMissionSafetyNotices('mission-a'));

    act(() => {
      result.current.confirmSafetyNotice();
    });
    expect(result.current.safetyNoticesComplete).toBe(false);
    expect(result.current.activeNotice?.id).toBe(MISSION_SAFETY_NOTICES[1]?.id);

    act(() => {
      result.current.confirmSafetyNotice();
    });
    expect(result.current.safetyNoticesComplete).toBe(true);
    expect(result.current.activeNotice).toBeNull();
  });

  it('does not reappear after refresh on the same mission', () => {
    const { result, unmount } = renderHook(() => useMissionSafetyNotices('mission-a'));

    act(() => {
      result.current.confirmSafetyNotice();
      result.current.confirmSafetyNotice();
    });
    expect(result.current.safetyNoticesComplete).toBe(true);
    unmount();

    const remounted = renderHook(() => useMissionSafetyNotices('mission-a'));
    expect(remounted.result.current.safetyNoticesComplete).toBe(true);
    expect(remounted.result.current.activeNotice).toBeNull();
  });

  it('resets when missionId changes', () => {
    const { result, rerender } = renderHook(({ missionId }) => useMissionSafetyNotices(missionId), {
      initialProps: { missionId: 'mission-a' },
    });

    act(() => {
      result.current.confirmSafetyNotice();
      result.current.confirmSafetyNotice();
    });
    expect(result.current.safetyNoticesComplete).toBe(true);

    rerender({ missionId: 'mission-b' });

    expect(result.current.safetyNoticesComplete).toBe(false);
    expect(result.current.activeNotice?.id).toBe(MISSION_SAFETY_NOTICES[0]?.id);
  });
});
