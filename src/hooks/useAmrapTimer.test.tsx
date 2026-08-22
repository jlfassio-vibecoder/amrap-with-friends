import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAmrapTimer } from './useAmrapTimer';

describe('useAmrapTimer', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('advances from setup into work via interval ticks', () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useAmrapTimer());

    act(() => {
      result.current.start({ setupDurationSec: 2, workDurationSec: 30 });
    });

    expect(result.current.phase).toBe('setup');
    expect(result.current.timeLeftSec).toBe(2);

    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    expect(result.current.phase).toBe('work');
    expect(result.current.timeLeftSec).toBe(30);
  });

  it('does not advance while paused', () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useAmrapTimer());

    act(() => {
      result.current.start({ setupDurationSec: 1, workDurationSec: 20 });
    });

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(result.current.phase).toBe('work');
    const timeLeftBeforePause = result.current.timeLeftSec;

    act(() => {
      result.current.pause();
      vi.advanceTimersByTime(3_000);
    });

    expect(result.current.isPaused).toBe(true);
    expect(result.current.timeLeftSec).toBe(timeLeftBeforePause);
  });
});
