import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import type { AmrapAuthContextValue } from '@/contexts/AmrapAuthContext';

const getOrCreateAnonIdMock = vi.fn();
const startGlobalPresenceBroadcastMock = vi.fn();

vi.mock('@/lib/analytics/identity', () => ({
  getOrCreateAnonId: (...args: unknown[]) => getOrCreateAnonIdMock(...args),
}));

vi.mock('@/lib/realtime/globalPresenceChannel', () => ({
  anonPresenceKey: (anonId: string) => `anon:${anonId}`,
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

  it('does not broadcast for a guest with no persistable anon id', () => {
    getOrCreateAnonIdMock.mockReturnValue(null);
    mockUseAmrapAuth.mockReturnValue(authValue());

    renderHook(() => useGlobalPresenceBroadcast());

    expect(startGlobalPresenceBroadcastMock).not.toHaveBeenCalled();
  });

  it('broadcasts anon:{uuid} for a guest with a persistable id', () => {
    getOrCreateAnonIdMock.mockReturnValue(UUID);
    mockUseAmrapAuth.mockReturnValue(authValue());

    renderHook(() => useGlobalPresenceBroadcast());

    expect(startGlobalPresenceBroadcastMock).toHaveBeenCalledWith(`anon:${UUID}`);
  });

  it('broadcasts the auth user id even when anon id is null', () => {
    getOrCreateAnonIdMock.mockReturnValue(null);
    mockUseAmrapAuth.mockReturnValue(
      authValue({
        user: { id: 'user-1' } as User,
        isAuthenticated: true,
      })
    );

    renderHook(() => useGlobalPresenceBroadcast());

    expect(startGlobalPresenceBroadcastMock).toHaveBeenCalledWith('user-1');
    expect(getOrCreateAnonIdMock).not.toHaveBeenCalled();
  });
});
