import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { SESSION_SAFETY_NOTICES } from './sessionSafetyNotices';
import { useSessionSafetyNotices } from './useSessionSafetyNotices';

describe('useSessionSafetyNotices', () => {
  it('starts with the first notice incomplete', () => {
    const { result } = renderHook(() => useSessionSafetyNotices('session-a'));

    expect(result.current.safetyNoticesComplete).toBe(false);
    expect(result.current.activeNotice?.id).toBe(SESSION_SAFETY_NOTICES[0]?.id);
  });

  it('advances through notices and completes after both confirms', () => {
    const { result } = renderHook(() => useSessionSafetyNotices('session-a'));

    act(() => {
      result.current.confirmSafetyNotice();
    });
    expect(result.current.safetyNoticesComplete).toBe(false);
    expect(result.current.activeNotice?.id).toBe(SESSION_SAFETY_NOTICES[1]?.id);

    act(() => {
      result.current.confirmSafetyNotice();
    });
    expect(result.current.safetyNoticesComplete).toBe(true);
    expect(result.current.activeNotice).toBeNull();
  });

  it('resets when sessionId changes', () => {
    const { result, rerender } = renderHook(
      ({ sessionId }) => useSessionSafetyNotices(sessionId),
      { initialProps: { sessionId: 'session-a' } }
    );

    act(() => {
      result.current.confirmSafetyNotice();
      result.current.confirmSafetyNotice();
    });
    expect(result.current.safetyNoticesComplete).toBe(true);

    rerender({ sessionId: 'session-b' });

    expect(result.current.safetyNoticesComplete).toBe(false);
    expect(result.current.activeNotice?.id).toBe(SESSION_SAFETY_NOTICES[0]?.id);
  });
});
