import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { AmrapAuthProvider } from '@/contexts/AmrapAuthProvider';
import { useAmrapAuth } from '@/hooks/useAmrapAuth';
import type { AmrapAuthContextValue } from '@/contexts/AmrapAuthContext';
import { AUTH_MIN_PASSWORD_LENGTH } from '@/lib/auth/passwordPolicy';

const signUpMock = vi.fn();
const signInWithPasswordMock = vi.fn();
const signInWithOtpMock = vi.fn();
const signInWithOAuthMock = vi.fn();
const resetPasswordForEmailMock = vi.fn();
const updateUserMock = vi.fn();

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: vi.fn(() => ({
    auth: {
      onAuthStateChange: (callback: (event: string, session: null) => void) => {
        callback('INITIAL_SESSION', null);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      signInWithOtp: signInWithOtpMock,
      signInWithOAuth: signInWithOAuthMock,
      signUp: signUpMock,
      signInWithPassword: signInWithPasswordMock,
      resetPasswordForEmail: resetPasswordForEmailMock,
      updateUser: updateUserMock,
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

vi.mock('@/lib/auth/authFeatures', () => ({
  isMagicLinkAuthEnabled: vi.fn(() => true),
  isPasswordResetEnabled: vi.fn(() => true),
  isGoogleAuthEnabled: vi.fn(() => true),
}));

import {
  isGoogleAuthEnabled,
  isMagicLinkAuthEnabled,
  isPasswordResetEnabled,
} from '@/lib/auth/authFeatures';

const isMagicLinkAuthEnabledMock = vi.mocked(isMagicLinkAuthEnabled);
const isPasswordResetEnabledMock = vi.mocked(isPasswordResetEnabled);
const isGoogleAuthEnabledMock = vi.mocked(isGoogleAuthEnabled);

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
    isMagicLinkAuthEnabledMock.mockReturnValue(true);
    isPasswordResetEnabledMock.mockReturnValue(true);
    isGoogleAuthEnabledMock.mockReturnValue(true);
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

  it('signInWithPassword maps wrong-password error', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Invalid login credentials' },
    });

    await renderProvider();

    const result = await authApi!.signInWithPassword('user@example.com', 'wrongpass');

    expect(result.error).toBe('Email or password is wrong. Reset it if you forgot.');
  });

  it('signUpWithPassword sets needsEmailConfirmation when session is null and identities exist', async () => {
    signUpMock.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'user@example.com',
          identities: [{ id: 'identity-1' }],
        },
        session: null,
      },
      error: null,
    });

    await renderProvider();

    const result = await authApi!.signUpWithPassword('user@example.com', 'password1');

    expect(signUpMock).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password1',
      options: {
        emailRedirectTo: expect.stringMatching(/^https?:\/\/.+/) as string,
      },
    });
    expect(result.error).toBeNull();
    expect(result.needsEmailConfirmation).toBe(true);
  });

  it('signUpWithPassword treats empty identities as a duplicate account', async () => {
    signUpMock.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'user@example.com', identities: [] },
        session: null,
      },
      error: null,
    });

    await renderProvider();

    const result = await authApi!.signUpWithPassword('user@example.com', 'password1');

    expect(result.error).toBe(
      'An account with this email already exists. Sign in or reset your password.'
    );
    expect(result.needsEmailConfirmation).toBe(false);
  });

  it('signUpWithPassword maps duplicate signup error', async () => {
    signUpMock.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User already registered' },
    });

    await renderProvider();

    const result = await authApi!.signUpWithPassword('user@example.com', 'password1');

    expect(result.error).toBe(
      'An account with this email already exists. Sign in or reset your password.'
    );
    expect(result.needsEmailConfirmation).toBe(false);
  });

  it('rejects password shorter than minimum before RPC', async () => {
    await renderProvider();

    const shortPassword = 'a'.repeat(AUTH_MIN_PASSWORD_LENGTH - 1);
    const result = await authApi!.signInWithPassword('user@example.com', shortPassword);

    expect(signInWithPasswordMock).not.toHaveBeenCalled();
    expect(result.error).toContain(String(AUTH_MIN_PASSWORD_LENGTH));
  });

  it('updateEmail flags needsEmailConfirmation when new_email is pending', async () => {
    updateUserMock.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'old@example.com', new_email: 'new@example.com' },
      },
      error: null,
    });

    await renderProvider();

    const result = await authApi!.updateEmail('new@example.com');

    expect(result.error).toBeNull();
    expect(result.needsEmailConfirmation).toBe(true);
  });

  it('rejects updatePassword shorter than minimum', async () => {
    await renderProvider();

    const shortPassword = 'a'.repeat(AUTH_MIN_PASSWORD_LENGTH - 1);
    const result = await authApi!.updatePassword(shortPassword);

    expect(updateUserMock).not.toHaveBeenCalled();
    expect(result.error).toContain(String(AUTH_MIN_PASSWORD_LENGTH));
  });

  it('requestPasswordReset calls resetPasswordForEmail when enabled', async () => {
    resetPasswordForEmailMock.mockResolvedValue({ data: {}, error: null });

    await renderProvider();

    const result = await authApi!.requestPasswordReset('user@example.com');

    expect(resetPasswordForEmailMock).toHaveBeenCalledWith(
      'user@example.com',
      expect.objectContaining({
        redirectTo: expect.stringMatching(/\/reset-password$/) as string,
      })
    );
    expect(result.error).toBeNull();
  });

  it('requestPasswordReset rejects when the flag is off', async () => {
    isPasswordResetEnabledMock.mockReturnValue(false);

    await renderProvider();

    const result = await authApi!.requestPasswordReset('user@example.com');

    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
    expect(result.error).toBe('Password reset is not available right now.');
  });

  it('signInWithGoogle calls signInWithOAuth with google and path+search redirect', async () => {
    signInWithOAuthMock.mockResolvedValue({
      data: { provider: 'google', url: 'https://accounts.google.com' },
      error: null,
    });

    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        origin: 'https://www.amrapwithfriends.com',
        pathname: '/join',
        search: '?c=invite-1',
      },
    });

    try {
      await renderProvider();

      const result = await authApi!.signInWithGoogle();

      expect(signInWithOAuthMock).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: 'https://www.amrapwithfriends.com/join?c=invite-1',
          queryParams: { prompt: 'select_account' },
        },
      });
      expect(result.error).toBeNull();
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    }
  });

  it('signInWithGoogle rejects when the flag is off', async () => {
    isGoogleAuthEnabledMock.mockReturnValue(false);

    await renderProvider();

    const result = await authApi!.signInWithGoogle();

    expect(signInWithOAuthMock).not.toHaveBeenCalled();
    expect(result.error).toBe('Google sign-in is not available right now.');
  });
});
