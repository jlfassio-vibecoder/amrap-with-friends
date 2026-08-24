import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { AmrapAuthProvider } from '@/contexts/AmrapAuthProvider';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import type { AmrapAuthContextValue } from '@/contexts/AmrapAuthContext';
import { AUTH_MIN_PASSWORD_LENGTH } from '@/lib/auth/passwordPolicy';

const signUpMock = vi.fn();
const signInWithPasswordMock = vi.fn();

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: vi.fn(() => ({
    auth: {
      onAuthStateChange: (callback: (event: string, session: null) => void) => {
        callback('INITIAL_SESSION', null);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      signInWithOtp: vi.fn(),
      signUp: signUpMock,
      signInWithPassword: signInWithPasswordMock,
      signOut: vi.fn(),
    },
  })),
  getSupabaseConfigError: vi.fn(() => null),
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

let authApi: AmrapAuthContextValue | null = null;

function AuthCapture() {
  const auth = useAmrapAuth();
  useEffect(() => {
    authApi = auth;
  }, [auth]);
  return null;
}

function renderProvider() {
  authApi = null;
  render(
    <AmrapAuthProvider>
      <AuthCapture />
    </AmrapAuthProvider>
  );
  return waitFor(() => {
    expect(authApi).not.toBeNull();
    expect(authApi?.isAuthLoading).toBe(false);
  });
}

describe('AmrapAuthProvider password auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('signInWithPassword returns no error on success', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } }, user: { id: 'user-1' } },
      error: null,
    });

    await renderProvider();

    const result = await authApi!.signInWithPassword('user@example.com', 'password1');

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password1',
    });
    expect(result.error).toBeNull();
  });

  it('signInWithPassword surfaces wrong-password error verbatim', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Invalid login credentials' },
    });

    await renderProvider();

    const result = await authApi!.signInWithPassword('user@example.com', 'wrongpass');

    expect(result.error).toBe('Invalid login credentials');
  });

  it('signUpWithPassword sets needsEmailConfirmation when session is null', async () => {
    signUpMock.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'user@example.com' },
        session: null,
      },
      error: null,
    });

    await renderProvider();

    const result = await authApi!.signUpWithPassword('user@example.com', 'password1');

    expect(signUpMock).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password1',
    });
    expect(result.error).toBeNull();
    expect(result.needsEmailConfirmation).toBe(true);
  });

  it('signUpWithPassword surfaces duplicate signup error verbatim', async () => {
    signUpMock.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User already registered' },
    });

    await renderProvider();

    const result = await authApi!.signUpWithPassword('user@example.com', 'password1');

    expect(result.error).toBe('User already registered');
    expect(result.needsEmailConfirmation).toBe(false);
  });

  it('rejects password shorter than minimum before RPC', async () => {
    await renderProvider();

    const shortPassword = 'a'.repeat(AUTH_MIN_PASSWORD_LENGTH - 1);
    const result = await authApi!.signInWithPassword('user@example.com', shortPassword);

    expect(signInWithPasswordMock).not.toHaveBeenCalled();
    expect(result.error).toContain(String(AUTH_MIN_PASSWORD_LENGTH));
  });
});
