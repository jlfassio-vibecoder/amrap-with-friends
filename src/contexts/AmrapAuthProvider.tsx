import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { track } from '@/lib/analytics/track';
import { validatePasswordLength } from '@/lib/auth/passwordPolicy';
import {
  isGoogleAuthEnabled,
  isMagicLinkAuthEnabled,
  isPasswordResetEnabled,
} from '@/lib/auth/authFeatures';
import { currentPathRedirectTo, passwordResetRedirectTo } from '@/lib/auth/authRedirect';
import { peekPostAuthPathIntent } from '@/lib/auth/postAuthDestination';
import { mapAuthError } from '@/lib/auth/mapAuthError';
import { getSupabaseClient } from '@/lib/supabase';
import { AmrapAuthContext, type AmrapAuthContextValue } from '@/contexts/AmrapAuthContext';

function trimEmail(email: string): string {
  return email.trim();
}

function mapProviderAuthError(message: string): string {
  return mapAuthError(message, {
    passwordResetEnabled: isPasswordResetEnabled(),
    googleAuthEnabled: isGoogleAuthEnabled(),
  });
}

/** Survives reload so /reset-password still works after PASSWORD_RECOVERY was already consumed. */
const PASSWORD_RECOVERY_STORAGE_KEY = 'amrap_password_recovery';

function readPasswordRecoveryFlag(): boolean {
  try {
    return sessionStorage.getItem(PASSWORD_RECOVERY_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writePasswordRecoveryFlag(active: boolean): void {
  try {
    if (active) {
      sessionStorage.setItem(PASSWORD_RECOVERY_STORAGE_KEY, '1');
    } else {
      sessionStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
    }
  } catch {
    /* sessionStorage unavailable */
  }
}

function providersFromUser(user: User | null | undefined): string[] {
  const identities = user?.identities ?? [];
  return [...new Set(identities.map((identity) => identity.provider).filter(Boolean))];
}

function authFailureReason(message: string): string {
  const normalized = message.trim().toLowerCase();
  if (normalized === 'user already registered' || normalized.includes('already exists')) {
    return 'duplicate';
  }
  if (
    normalized === 'invalid login credentials' ||
    normalized.includes('email or password is wrong')
  ) {
    return 'invalid_credentials';
  }
  if (normalized === 'email not confirmed') {
    return 'email_not_confirmed';
  }
  if (
    normalized.includes('cancelled') ||
    normalized.includes('canceled') ||
    normalized === 'access_denied'
  ) {
    return 'cancelled';
  }
  return 'other';
}

export function AmrapAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AmrapAuthContextValue['user']>(null);
  const [session, setSession] = useState<AmrapAuthContextValue['session']>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    let initialResolved = false;
    let subscription: { unsubscribe: () => void } | undefined;

    const resolveLoading = () => {
      if (!initialResolved) {
        initialResolved = true;
        setIsAuthLoading(false);
      }
    };

    try {
      const supabase = getSupabaseClient();

      void supabase.auth
        .getSession()
        .then(({ data: { session: initialSession } }) => {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          if (initialSession && readPasswordRecoveryFlag()) {
            setIsPasswordRecovery(true);
          } else if (!initialSession) {
            writePasswordRecoveryFlag(false);
            setIsPasswordRecovery(false);
          }
          resolveLoading();
        })
        .catch(() => {
          setSession(null);
          setUser(null);
          writePasswordRecoveryFlag(false);
          setIsPasswordRecovery(false);
          resolveLoading();
        });

      const {
        data: { subscription: authSubscription },
      } = supabase.auth.onAuthStateChange((event, nextSession) => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        if (event === 'PASSWORD_RECOVERY') {
          writePasswordRecoveryFlag(true);
          setIsPasswordRecovery(true);
        } else if (event === 'SIGNED_OUT') {
          writePasswordRecoveryFlag(false);
          setIsPasswordRecovery(false);
        } else if (event === 'SIGNED_IN' && nextSession?.user) {
          track(
            'auth_signed_in',
            { providers: providersFromUser(nextSession.user) },
            { userId: nextSession.user.id }
          );
        }

        // Resolve loading on the first auth event so UI is never stuck waiting for
        // INITIAL_SESSION alone (SIGNED_IN / TOKEN_REFRESHED can arrive first).
        resolveLoading();
      });
      subscription = authSubscription;
    } catch {
      resolveLoading();
    }

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const clearPasswordRecovery = useCallback(() => {
    writePasswordRecoveryFlag(false);
    setIsPasswordRecovery(false);
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    if (!isMagicLinkAuthEnabled()) {
      return { error: 'Magic link sign-in is not available. Use email and password.' };
    }

    const trimmed = trimEmail(email);
    if (!trimmed) {
      return { error: 'Enter your email address.' };
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: currentPathRedirectTo() },
    });

    if (error) {
      return { error: mapProviderAuthError(error.message) };
    }

    return { error: null };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!isGoogleAuthEnabled()) {
      return { error: 'Google sign-in is not available right now.' };
    }

    track('auth_google_started', { method: 'google' });

    const supabase = getSupabaseClient();
    const intent = peekPostAuthPathIntent();
    const redirectTo = intent ? `${window.location.origin}${intent}` : currentPathRedirectTo();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: { prompt: 'select_account' },
      },
    });

    if (error) {
      const mapped = mapProviderAuthError(error.message);
      track('auth_google_failed', {
        method: 'google',
        reason: authFailureReason(error.message),
      });
      return { error: mapped };
    }

    return { error: null };
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    const trimmed = trimEmail(email);
    if (!trimmed) {
      return { error: 'Enter your email address.', needsEmailConfirmation: false };
    }

    const passwordCheck = validatePasswordLength(password);
    if (!passwordCheck.ok) {
      return { error: passwordCheck.error, needsEmailConfirmation: false };
    }

    track('auth_sign_up_attempted', { method: 'password' });

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email: trimmed,
      password,
      options: { emailRedirectTo: currentPathRedirectTo() },
    });

    if (error) {
      const mapped = mapProviderAuthError(error.message);
      track('auth_sign_up_failed', {
        method: 'password',
        reason: authFailureReason(error.message),
      });
      return { error: mapped, needsEmailConfirmation: false };
    }

    if (data.session) {
      track('auth_sign_up_succeeded', { method: 'password' }, { userId: data.session.user.id });
      return { error: null, needsEmailConfirmation: false };
    }

    if (data.user) {
      if ((data.user.identities ?? []).length === 0) {
        const mapped = mapProviderAuthError('User already registered');
        track('auth_sign_up_failed', { method: 'password', reason: 'duplicate' });
        return {
          error: mapped,
          needsEmailConfirmation: false,
        };
      }
      track('auth_sign_up_needs_confirmation', { method: 'password' }, { userId: data.user.id });
      return { error: null, needsEmailConfirmation: true };
    }

    track('auth_sign_up_failed', { method: 'password', reason: 'other' });
    return {
      error: 'Something went wrong. Please try again.',
      needsEmailConfirmation: false,
    };
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const trimmed = trimEmail(email);
    if (!trimmed) {
      return { error: 'Enter your email address.' };
    }

    const passwordCheck = validatePasswordLength(password);
    if (!passwordCheck.ok) {
      return { error: passwordCheck.error };
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    });

    if (error) {
      const mapped = mapProviderAuthError(error.message);
      track('auth_sign_in_failed', {
        method: 'password',
        reason: authFailureReason(error.message),
      });
      return { error: mapped };
    }

    track(
      'auth_sign_in_succeeded',
      { method: 'password' },
      { userId: data.user?.id ?? data.session?.user?.id ?? null }
    );
    return { error: null };
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    if (!isPasswordResetEnabled()) {
      return { error: 'Password reset is not available right now.' };
    }

    const trimmed = trimEmail(email);
    if (!trimmed) {
      return { error: 'Enter your email address.' };
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: passwordResetRedirectTo(),
    });

    if (error) {
      return { error: mapProviderAuthError(error.message) };
    }

    return { error: null };
  }, []);

  const updateEmail = useCallback(async (email: string) => {
    const trimmed = trimEmail(email);
    if (!trimmed) {
      return { error: 'Enter your email address.', needsEmailConfirmation: false };
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.updateUser({ email: trimmed });

    if (error) {
      return { error: error.message, needsEmailConfirmation: false };
    }

    const pendingEmail = typeof data.user?.new_email === 'string' && data.user.new_email.length > 0;

    return {
      error: null,
      needsEmailConfirmation: pendingEmail,
    };
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const passwordCheck = validatePasswordLength(password);
    if (!passwordCheck.ok) {
      return { error: passwordCheck.error };
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      return { error: error.message };
    }

    writePasswordRecoveryFlag(false);
    setIsPasswordRecovery(false);
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    writePasswordRecoveryFlag(false);
    setIsPasswordRecovery(false);
  }, []);

  const value = useMemo(
    (): AmrapAuthContextValue => ({
      user,
      session,
      isAuthLoading,
      isAuthenticated: user !== null,
      isPasswordRecovery,
      signInWithMagicLink,
      signInWithGoogle,
      signUpWithPassword,
      signInWithPassword,
      requestPasswordReset,
      updateEmail,
      updatePassword,
      clearPasswordRecovery,
      signOut,
    }),
    [
      user,
      session,
      isAuthLoading,
      isPasswordRecovery,
      signInWithMagicLink,
      signInWithGoogle,
      signUpWithPassword,
      signInWithPassword,
      requestPasswordReset,
      updateEmail,
      updatePassword,
      clearPasswordRecovery,
      signOut,
    ]
  );

  return <AmrapAuthContext.Provider value={value}>{children}</AmrapAuthContext.Provider>;
}
