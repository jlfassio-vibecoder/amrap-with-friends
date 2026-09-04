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
const trackMock = vi.fn();
const linkCurrentAnonIdentityMock = vi.fn();

type AuthStateCallback = (
  event: string,
  session: {
    user: { id: string; app_metadata?: { provider?: string; providers?: string[] } };
  } | null
) => void;

let authStateCallback: AuthStateCallback | null = null;
let fireInitialSession = true;

vi.mock('@/lib/analytics/track', () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

vi.mock('@/lib/api/linkAnonIdentity', () => ({
  linkCurrentAnonIdentity: (...args: unknown[]) => linkCurrentAnonIdentityMock(...args),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: vi.fn(() => ({
    auth: {
      onAuthStateChange: (callback: AuthStateCallback) => {
        authStateCallback = callback;
        if (fireInitialSession) {
          callback('INITIAL_SESSION', null);
        }
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
    authStateCallback = null;
    fireInitialSession = true;
    linkCurrentAnonIdentityMock.mockResolvedValue(undefined);
    isMagicLinkAuthEnabledMock.mockReturnValue(true);
    isPasswordResetEnabledMock.mockReturnValue(true);
    isGoogleAuthEnabledMock.mockReturnValue(true);
  });

  it('stitches anon identity once on SIGNED_IN', async () => {
    await renderProvider();
    expect(linkCurrentAnonIdentityMock).not.toHaveBeenCalled();

    authStateCallback?.('SIGNED_IN', {
      user: { id: 'user-1', app_metadata: { provider: 'email', providers: ['email'] } },
    });

    await waitFor(() => {
      expect(linkCurrentAnonIdentityMock).toHaveBeenCalledTimes(1);
    });
    expect(trackMock).toHaveBeenCalledWith(
      'auth_signed_in',
      expect.objectContaining({ providers: expect.any(Array) }),
      expect.objectContaining({ userId: 'user-1' })
    );
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
    expect(trackMock).toHaveBeenCalledWith(
      'auth_sign_in_succeeded',
      expect.objectContaining({ method: 'password' }),
      expect.objectContaining({ userId: 'user-1' })
    );
  });

  it('signInWithPassword maps wrong-password error', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Invalid login credentials' },
    });

    await renderProvider();

    const result = await authApi!.signInWithPassword('user@example.com', 'wrongpass');

    expect(result.error).toBe(
      'Email or password is wrong. Reset it if you forgot, or Continue with Google.'
    );
    expect(trackMock).toHaveBeenCalledWith(
      'auth_sign_in_failed',
      expect.objectContaining({ method: 'password', reason: 'invalid_credentials' })
    );
    expect(
      trackMock.mock.calls.every((call) => !JSON.stringify(call).includes('user@example.com'))
    ).toBe(true);
  });

  it('classifies email-not-confirmed failures from the raw GoTrue message', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Email not confirmed' },
    });

    await renderProvider();

    const result = await authApi!.signInWithPassword('user@example.com', 'password1');

    expect(result.error).toBe('Confirm your email, then sign in.');
    expect(trackMock).toHaveBeenCalledWith(
      'auth_sign_in_failed',
      expect.objectContaining({ method: 'password', reason: 'email_not_confirmed' })
    );
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
    expect(trackMock).toHaveBeenCalledWith(
      'auth_sign_up_attempted',
      expect.objectContaining({ method: 'password' })
    );
    expect(trackMock).toHaveBeenCalledWith(
      'auth_sign_up_needs_confirmation',
      expect.objectContaining({ method: 'password' }),
      expect.objectContaining({ userId: 'user-1' })
    );
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
      'An account with this email already exists. Sign in, reset your password, or Continue with Google.'
    );
    expect(result.needsEmailConfirmation).toBe(false);
    expect(trackMock).toHaveBeenCalledWith(
      'auth_sign_up_failed',
      expect.objectContaining({ method: 'password', reason: 'duplicate' })
    );
  });

  it('signUpWithPassword maps duplicate signup error', async () => {
    signUpMock.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User already registered' },
    });

    await renderProvider();

    const result = await authApi!.signUpWithPassword('user@example.com', 'password1');

    expect(result.error).toBe(
      'An account with this email already exists. Sign in, reset your password, or Continue with Google.'
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
      expect(trackMock).toHaveBeenCalledWith(
        'auth_google_started',
        expect.objectContaining({ method: 'google' })
      );
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
