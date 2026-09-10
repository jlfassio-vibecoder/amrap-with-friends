import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { useRefetchOnVisible } from './useRefetchOnVisible';

describe('useRefetchOnVisible', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('does not refetch on mount when already visible', () => {
    const refetch = vi.fn();
    renderHook(() => useRefetchOnVisible(true, refetch));
    expect(refetch).not.toHaveBeenCalled();
  });

  it('refetches when the tab becomes visible after being hidden', () => {
    const refetch = vi.fn();
    renderHook(() => useRefetchOnVisible(true, refetch));

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(refetch).not.toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('does not refetch when disabled', () => {
    const refetch = vi.fn();
    renderHook(() => useRefetchOnVisible(false, refetch));

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(refetch).not.toHaveBeenCalled();
  });
});
