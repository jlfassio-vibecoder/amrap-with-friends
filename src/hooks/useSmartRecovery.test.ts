import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSmartRecovery } from './useSmartRecovery';
import {
  resetSmartRecoveryPrefs,
  writeSmartRecoveryEnabled,
} from '@/lib/smartRecovery/smartRecoveryPrefs';

const fetchSmartRecoveryHistory = vi.fn();

vi.mock('@/lib/api/smartRecovery', () => ({
  fetchSmartRecoveryHistory: (...args: unknown[]) => fetchSmartRecoveryHistory(...args),
}));

vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: vi.fn(),
}));

import { useAmrapAuth } from '@/hooks/useAmrapAuth';

const mockUseAmrapAuth = vi.mocked(useAmrapAuth);

describe('useSmartRecovery', () => {
  beforeEach(() => {
    resetSmartRecoveryPrefs();
    fetchSmartRecoveryHistory.mockReset();
    mockUseAmrapAuth.mockReturnValue({
      user: { id: 'user-1', email: 'athlete@example.com' } as import('@supabase/supabase-js').User,
      session: null,
      isAuthenticated: true,
      isAuthLoading: false,
      signInWithMagicLink: vi.fn(),
      signUpWithPassword: vi.fn(),
      signInWithPassword: vi.fn(),
      updateEmail: vi.fn(),
      updatePassword: vi.fn(),
      signOut: vi.fn(),
    });
  });

  afterEach(() => {
    resetSmartRecoveryPrefs();
  });

  it('defaults to disabled with empty locks', () => {
    const { result } = renderHook(() => useSmartRecovery());

    expect(result.current.enabled).toBe(false);
    expect(result.current.locks.size).toBe(0);
    expect(fetchSmartRecoveryHistory).not.toHaveBeenCalled();
  });

  it('fetches history when enabled, authenticated, and active', async () => {
    writeSmartRecoveryEnabled(true);
    fetchSmartRecoveryHistory.mockResolvedValue({
      data: {
        completions: [
          {
            templateId: 'the-hull-breach',
            intensityTier: 5,
            completedAt: '2026-08-30T12:00:00.000Z',
          },
        ],
      },
      error: null,
    });

    const { result } = renderHook(() => useSmartRecovery({ active: true }));

    expect(result.current.enabled).toBe(true);

    await waitFor(() => {
      expect(fetchSmartRecoveryHistory).toHaveBeenCalledTimes(1);
      expect(result.current.loading).toBe(false);
    });
  });

  it('does not fetch when inactive', async () => {
    writeSmartRecoveryEnabled(true);

    renderHook(() => useSmartRecovery({ active: false }));

    await waitFor(() => {
      expect(fetchSmartRecoveryHistory).not.toHaveBeenCalled();
    });
  });

  it('clears locks immediately when disabled', async () => {
    writeSmartRecoveryEnabled(true);
    fetchSmartRecoveryHistory.mockResolvedValue({
      data: {
        completions: [
          {
            templateId: 'the-hull-breach',
            intensityTier: 5,
            completedAt: new Date().toISOString(),
          },
        ],
      },
      error: null,
    });

    const { result } = renderHook(() => useSmartRecovery({ active: true }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setEnabled(false);
    });

    expect(result.current.locks.size).toBe(0);
  });
});
