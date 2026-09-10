import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import type { AmrapAuthContextValue } from '@/contexts/AmrapAuthContext';

const getOrCreateAnonIdMock = vi.fn();
const trackMock = vi.fn();
const startGlobalPresenceBroadcastMock = vi.fn();

vi.mock('@/lib/analytics/identity', () => ({
  getOrCreateAnonId: (...args: unknown[]) => getOrCreateAnonIdMock(...args),
}));

vi.mock('@/lib/analytics/track', () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

vi.mock('@/lib/realtime/globalPresenceChannel', () => ({
  startGlobalPresenceBroadcast: (...args: unknown[]) => startGlobalPresenceBroadcastMock(...args),
}));

vi.mock('@/hooks/useAmrapAuth', () => ({
  useAmrapAuth: vi.fn(),
}));

import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import { useGlobalPresenceBroadcast } from '@/hooks/useGlobalPresenceBroadcast';

const mockUseAmrapAuth = vi.mocked(useAmrapAuth);
const UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function authValue(overrides: Partial<AmrapAuthContextValue> = {}): AmrapAuthContextValue {
  return {
    user: null,
    session: null,
    isAuthenticated: false,
    isAuthLoading: false,
    isPasswordRecovery: false,
    signInWithMagicLink: vi.fn(),
    signInWithGoogle: vi.fn(),
    signUpWithPassword: vi.fn(),
    signInWithPassword: vi.fn(),
    requestPasswordReset: vi.fn(),
    updateEmail: vi.fn(),
    updatePassword: vi.fn(),
    clearPasswordRecovery: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  };
}

describe('useGlobalPresenceBroadcast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startGlobalPresenceBroadcastMock.mockReturnValue(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('does not heartbeat for a guest with no persistable anon id', () => {
    getOrCreateAnonIdMock.mockReturnValue(null);
    mockUseAmrapAuth.mockReturnValue(authValue());

    renderHook(() => useGlobalPresenceBroadcast());

    expect(trackMock).not.toHaveBeenCalled();
    expect(startGlobalPresenceBroadcastMock).not.toHaveBeenCalled();
  });

  it('writes presence_heartbeat with a null userId for a guest with a persistable id', () => {
    getOrCreateAnonIdMock.mockReturnValue(UUID);
    mockUseAmrapAuth.mockReturnValue(authValue());

    renderHook(() => useGlobalPresenceBroadcast());

    expect(trackMock).toHaveBeenCalledWith('presence_heartbeat', {}, { userId: null });
    expect(startGlobalPresenceBroadcastMock).not.toHaveBeenCalled();
  });

  it('writes presence_heartbeat with the auth user id and never joins Presence', () => {
    getOrCreateAnonIdMock.mockReturnValue(null);
    mockUseAmrapAuth.mockReturnValue(
      authValue({
        user: { id: 'user-1' } as User,
        isAuthenticated: true,
      })
    );

    renderHook(() => useGlobalPresenceBroadcast());

    expect(trackMock).toHaveBeenCalledWith('presence_heartbeat', {}, { userId: 'user-1' });
    expect(startGlobalPresenceBroadcastMock).not.toHaveBeenCalled();
    expect(getOrCreateAnonIdMock).not.toHaveBeenCalled();
  });

  it('does not heartbeat while auth is still loading', () => {
    getOrCreateAnonIdMock.mockReturnValue(UUID);
    mockUseAmrapAuth.mockReturnValue(authValue({ isAuthLoading: true }));

    renderHook(() => useGlobalPresenceBroadcast());

    expect(trackMock).not.toHaveBeenCalled();
    expect(startGlobalPresenceBroadcastMock).not.toHaveBeenCalled();
  });

  it('fires again on the 60s interval and when the tab becomes visible', () => {
    vi.useFakeTimers();
    getOrCreateAnonIdMock.mockReturnValue(UUID);
    mockUseAmrapAuth.mockReturnValue(authValue());

    renderHook(() => useGlobalPresenceBroadcast());

    expect(trackMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_000);
    expect(trackMock).toHaveBeenCalledTimes(2);

    document.dispatchEvent(new Event('visibilitychange'));
    expect(trackMock).toHaveBeenCalledTimes(3);
    expect(startGlobalPresenceBroadcastMock).not.toHaveBeenCalled();
  });
});
